import type { MediaAsset, PostTarget, SocialAccount } from "@prisma/client";
import {
  getConstraints,
  validatePost as validatePlatformPost,
} from "@/lib/platforms/constraints";
import {
  analyticsResultSchema,
  authCheckResultSchema,
  publishResultSchema,
  type AnalyticsResult,
  type AuthCheckResult,
  type PublishInput,
  type PublishResult,
  type SocialPlatformAdapter,
} from "@/lib/platforms/types";
import { decryptToken, EncryptionConfigError } from "@/lib/crypto";
import { loadMetaConfig, type MetaConfig } from "@/lib/platforms/oauth/meta";

/**
 * Real Meta Graph API adapter for Facebook Page posts.
 *
 * Phase 2a scope:
 *   ✓ Real OAuth connect (encrypted Page access token stored on SocialAccount)
 *   ✓ checkAuth (GET /{page-id})
 *   ✓ publishPost (POST /{page-id}/feed)
 *   ✗ Analytics — throws AnalyticsNotImplementedError (deferred to a future phase)
 *   ✗ Media publishing — text-only /feed posts only; IG publishing is deferred
 *     (needs a publicly fetchable image URL — see docs/meta-integration.md)
 *
 * Adapter contract: features never call this directly; they go through the
 * adapter registry (registry.ts). The Page access token lives encrypted on
 * `SocialAccount.accessToken` (decrypted here on demand); `externalAccountId`
 * holds the Page ID. The publish idempotency envelope is enforced by the
 * publisher (the SCHEDULED → PUBLISHING atomic claim), so this adapter does
 * not dedupe — repeated publishPost calls with the same target will produce
 * repeated platform posts unless the publisher gate blocks them first.
 */

export class AnalyticsNotImplementedError extends Error {
  constructor(platform: string) {
    super(`Real ${platform} analytics is not implemented in this phase.`);
    this.name = "AnalyticsNotImplementedError";
  }
}

function graphVersion(): string {
  return process.env.META_GRAPH_API_VERSION ?? "v19.0";
}

function decryptAccessToken(account: SocialAccount): string {
  // Encrypted base64 (iv || ciphertext || authTag), see lib/crypto.ts.
  return decryptToken(account.accessToken);
}

function pageId(account: SocialAccount): string {
  if (!account.externalAccountId) {
    throw new Error("Facebook account is missing its Page id.");
  }
  return account.externalAccountId;
}

interface GraphError {
  status: number;
  message: string;
  type?: string;
  code?: number;
  subcode?: number;
}

async function parseGraphError(
  response: Response,
  defaultMessage: string,
): Promise<GraphError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    return { status: response.status, message: defaultMessage };
  }

  const errorBody = body as {
    error?: { message?: string; type?: string; code?: number; error_subcode?: number };
  };
  const metaError = errorBody?.error;
  const message = metaError?.message ?? defaultMessage;

  return {
    status: response.status,
    message,
    type: metaError?.type,
    code: metaError?.code,
    subcode: metaError?.error_subcode,
  };
}

function isAuthExpiredError(error: GraphError): boolean {
  if (error.status === 401) return true;
  // Meta Graph error codes signalling invalid/expired tokens.
  // 190: OAuth exception, 463: expired, 460: password changed, 467: invalid.
  if (error.code === 190 || error.code === 463 || error.code === 460 || error.code === 467) {
    return true;
  }
  return false;
}

function isRateLimited(error: GraphError): boolean {
  if (error.status === 429) return true;
  // 4: usage-throttle, 17: user-request-limit, 32: app-limit, 613: rate limit.
  return error.code === 4 || error.code === 17 || error.code === 32 || error.code === 613;
}

function isRetryable(error: GraphError): boolean {
  if (error.status >= 500) return true;
  if (isRateLimited(error)) return true;
  return false;
}

function sanitizeError(error: GraphError): string {
  if (isAuthExpiredError(error)) {
    return "Reconnect your Facebook account to continue publishing.";
  }
  if (isRateLimited(error)) {
    return "Facebook is rate-limiting this account. Please retry shortly.";
  }
  if (error.status >= 500) {
    return "Facebook is temporarily unavailable. Please retry shortly.";
  }
  // Never leak Meta's raw error body to the UI.
  return "Facebook rejected this post. Check the content and try again.";
}

function buildPublishedUrl(pageId: string, postId: string): string {
  // /{page-id}_{post-id} form is standard for FB post permalinks.
  const composite = postId.includes("_") ? postId : `${pageId}_${postId}`;
  return `https://www.facebook.com/${composite}`;
}

export class RealFacebookAdapter implements SocialPlatformAdapter {
  readonly platform = "FACEBOOK" as const;
  private readonly config: MetaConfig | null = null;

  constructor() {
    // We resolve config lazily on first use so the registry can be constructed
    // in environments where Meta devs aren't configured (e.g. unit tests).
    try {
      this.config = loadMetaConfig();
    } catch {
      this.config = null;
    }
  }

  private requireConfig(): MetaConfig {
    if (!this.config) {
      throw new Error(
        "Meta OAuth is not configured. Set META_APP_ID, META_APP_SECRET, META_REDIRECT_URI and META_GRAPH_API_VERSION.",
      );
    }
    return this.config;
  }

  getConstraints() {
    return getConstraints("FACEBOOK");
  }

  validatePost(input: PublishInput): { valid: boolean; errors: string[] } {
    return validatePlatformPost(
      "FACEBOOK",
      input.text,
      input.media.map((asset) => ({
        type: asset.type,
        mimeType: undefined,
        sizeBytes: asset.sizeBytes,
      })),
    );
  }

  async checkAuth(account: SocialAccount): Promise<AuthCheckResult> {
    try {
      const token = decryptAccessToken(account);
      const pageIdValue = pageId(account);
      const url = new URL(
        `https://graph.facebook.com/${graphVersion()}/${pageIdValue}`,
      );
      url.searchParams.set("fields", "name");
      url.searchParams.set("access_token", token);

      const response = await fetch(url);
      if (response.ok) {
        return authCheckResultSchema.parse({ active: true });
      }

      const error = await parseGraphError(response, "Unable to verify Facebook account.");
      if (isAuthExpiredError(error)) {
        return authCheckResultSchema.parse({ active: false });
      }
      // Non-auth errors (transient Graph API hiccup) conservatively report
      // active=true so the publisher attempts the real call; auth-correctness
      // is enforced at publish time.
      return authCheckResultSchema.parse({ active: true });
    } catch (error) {
      if (error instanceof EncryptionConfigError) {
        // Cannot decrypt → token is unusable. Treat as auth-expired so the
        // publisher surfaces the reconnect CTA (SPEC §5.3).
        return authCheckResultSchema.parse({ active: false });
      }
      // Network/parse failures shouldn't permanently block publishing.
      return authCheckResultSchema.parse({ active: true });
    }
  }

  async publishPost(input: PublishInput): Promise<PublishResult> {
    const validation = this.validatePost(input);
    if (!validation.valid) {
      return publishResultSchema.parse({
        ok: false,
        error: validation.errors.join(". "),
        retryable: false,
      });
    }

    let token: string;
    let pageIdValue: string;
    try {
      token = decryptAccessToken(input.account);
      pageIdValue = pageId(input.account);
    } catch (error) {
      if (error instanceof EncryptionConfigError) {
        return publishResultSchema.parse({
          ok: false,
          error: "Reconnect your Facebook account to publish this target.",
          authExpired: true,
          retryable: false,
        });
      }
      return publishResultSchema.parse({
        ok: false,
        error: "Unable to publish this target.",
        retryable: true,
      });
    }

    // Touch config so misconfiguration surfaces as 500-style retryable errors
    // rather than silent failures.
    this.requireConfig();

    const url = new URL(
      `https://graph.facebook.com/${graphVersion()}/${pageIdValue}/feed`,
    );
    url.searchParams.set("message", input.text);
    url.searchParams.set("access_token", token);

    let response: Response;
    try {
      response = await fetch(url, { method: "POST" });
    } catch {
      return publishResultSchema.parse({
        ok: false,
        error: "Unable to reach Facebook. Please retry shortly.",
        retryable: true,
      });
    }

    if (response.ok) {
      const body = (await response.json()) as { id?: string };
      if (typeof body.id === "string" && body.id.length > 0) {
        return publishResultSchema.parse({
          ok: true,
          publishedUrl: buildPublishedUrl(pageIdValue, body.id),
        });
      }
      return publishResultSchema.parse({
        ok: false,
        error: "Facebook accepted the post but did not return a permalink.",
        retryable: true,
      });
    }

    const error = await parseGraphError(response, "Facebook publishing failed.");
    return publishResultSchema.parse({
      ok: false,
      error: sanitizeError(error),
      authExpired: isAuthExpiredError(error),
      retryable: isRetryable(error),
    });
  }

  async fetchAnalytics(_target: PostTarget): Promise<AnalyticsResult> {
    throw new AnalyticsNotImplementedError("Facebook");
  }
}

// Re-export the schema so analytics callers can validate without importing
// the unused module-level instance.
export { analyticsResultSchema };