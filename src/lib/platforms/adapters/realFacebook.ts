import type { PostTarget, SocialAccount } from "@prisma/client";
import {
  getConstraints,
  validatePost as validatePlatformPost,
} from "@/lib/platforms/constraints";
import {
  authCheckResultSchema,
  publishResultSchema,
  type AnalyticsResult,
  type AuthCheckResult,
  type PublishInput,
  type PublishResult,
  type SocialPlatformAdapter,
} from "@/lib/platforms/types";
import { decryptToken, encryptToken } from "@/lib/tokens/crypto";
import {
  loadMetaConfig,
  refreshUserToken,
  type MetaConfig,
} from "@/lib/platforms/oauth/meta";

/**
 * Real Meta Graph API adapter for Facebook Page posts.
 *
 * Phase 2a scope:
 *   ✓ Real OAuth connect (encrypted Page access token stored on SocialAccount)
 *   ✓ checkAuth (GET /{page-id}) with opportunistic long-lived token refresh
 *   ✓ publishPost (POST /{page-id}/feed)
 *   ✗ Analytics — throws AnalyticsNotImplementedError (deferred to a future phase)
 *   ✗ Media publishing — text-only /feed posts only; IG publishing is deferred
 *     (needs a publicly fetchable image URL — see docs/meta-integration.md)
 *
 * Token model (aligns with main's SocialAccount columns):
 *   accessToken  → encrypted Page access token (used for /feed POST)
 *   refreshToken → encrypted long-lived user token (refreshable ~60-day window)
 *   expiresAt    → user-token expiry; refreshed opportunistically in checkAuth
 *   platformUserId → Facebook Page ID (or IG business-account ID)
 *
 * The publish idempotency envelope is enforced by the publisher (the atomic
 * SCHEDULED → PUBLISHING claim), so this adapter does not dedupe — repeated
 * publishPost calls with the same target will produce repeated platform posts
 * unless the publisher gate blocks them first.
 */

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const GRAPH_API_VERSION_DEFAULT = "v19.0";

export class AnalyticsNotImplementedError extends Error {
  constructor(platform: string) {
    super(`Real ${platform} analytics is not implemented in this phase.`);
    this.name = "AnalyticsNotImplementedError";
  }
}

export interface RealFacebookAdapterDependencies {
  loadMetaConfig: () => MetaConfig;
  refreshUserToken: typeof refreshUserToken;
  decryptToken: typeof decryptToken;
  encryptToken: typeof encryptToken;
  fetch?: typeof fetch;
  now?: () => Date;
}

function getFetch(): typeof fetch {
  return fetch;
}

function graphVersion(): string {
  return process.env.META_GRAPH_API_VERSION ?? GRAPH_API_VERSION_DEFAULT;
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

  return {
    status: response.status,
    message: metaError?.message ?? defaultMessage,
    type: metaError?.type,
    code: metaError?.code,
    subcode: metaError?.error_subcode,
  };
}

function isAuthExpiredError(error: GraphError): boolean {
  if (error.status === 401) return true;
  // 190: OAuth exception, 463: expired, 460: password changed, 467: invalid.
  return error.code === 190 || error.code === 463 || error.code === 460 || error.code === 467;
}

function isRateLimited(error: GraphError): boolean {
  if (error.status === 429) return true;
  // 4: usage-throttle, 17: user-request-limit, 32: app-limit, 613: rate limit.
  return error.code === 4 || error.code === 17 || error.code === 32 || error.code === 613;
}

function isRetryable(error: GraphError): boolean {
  if (error.status >= 500) return true;
  return isRateLimited(error);
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
  const composite = postId.includes("_") ? postId : `${pageId}_${postId}`;
  return `https://www.facebook.com/${composite}`;
}

function platformUserId(account: SocialAccount): string {
  if (!account.platformUserId) {
    throw new Error("Facebook account is missing its Page id (platformUserId).");
  }
  return account.platformUserId;
}

export class RealFacebookAdapter implements SocialPlatformAdapter {
  readonly platform = "FACEBOOK" as const;
  private readonly deps: RealFacebookAdapterDependencies;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => Date;

  constructor(dependencies: Partial<RealFacebookAdapterDependencies> = {}) {
    this.deps = {
      loadMetaConfig: dependencies.loadMetaConfig ?? loadMetaConfig,
      refreshUserToken: dependencies.refreshUserToken ?? refreshUserToken,
      decryptToken: dependencies.decryptToken ?? decryptToken,
      encryptToken: dependencies.encryptToken ?? encryptToken,
      fetch: dependencies.fetch ?? getFetch(),
      now: dependencies.now ?? (() => new Date()),
    };
    this.fetchFn = this.deps.fetch!;
    this.now = this.deps.now!;
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
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
      })),
    );
  }

  /**
   * Opportunistic refresh of the long-lived Meta user token. Mirrors the
   * LinkedIn adapter's ensureFreshToken: if the user token is within 5 minutes
   * of expiry and a refreshToken is present, exchange it for a fresh one,
   * persist the new encrypted tokens, and return the updated account. Page
   * access tokens (in `accessToken`) don't change during this refresh — they
   * remain valid as long as the user token is valid.
   */
  private async ensureFreshToken(account: SocialAccount): Promise<SocialAccount> {
    const { decryptToken: decrypt, encryptToken: encrypt } = this.deps;

    const isNearExpiry =
      account.expiresAt !== null &&
      account.expiresAt.getTime() - TOKEN_EXPIRY_BUFFER_MS <= this.now().getTime();

    if (!isNearExpiry || !account.refreshToken) {
      return account;
    }

    const config = this.deps.loadMetaConfig();
    const refreshToken = decrypt(account.refreshToken);

    const refreshed = await this.deps.refreshUserToken(config, refreshToken);

    const newExpiresAt = refreshed.expiresInSeconds
      ? new Date(this.now().getTime() + refreshed.expiresInSeconds * 1000)
      : account.expiresAt;

    const encryptedRefreshToken = encrypt(refreshed.accessToken);

    const { db } = await import("@/lib/db");
    const updated = await db.socialAccount.update({
      where: { id: account.id },
      data: {
        refreshToken: encryptedRefreshToken,
        expiresAt: newExpiresAt,
        status: "ACTIVE",
      },
    });

    return updated;
  }

  async checkAuth(account: SocialAccount): Promise<AuthCheckResult> {
    try {
      const freshAccount = await this.ensureFreshToken(account);
      const token = this.deps.decryptToken(freshAccount.accessToken);
      const pageIdValue = platformUserId(freshAccount);

      const url = new URL(
        `https://graph.facebook.com/${graphVersion()}/${pageIdValue}`,
      );
      url.searchParams.set("fields", "name");
      url.searchParams.set("access_token", token);

      const response = await this.fetchFn(url);
      if (response.ok) {
        return authCheckResultSchema.parse({
          active: freshAccount.status === "ACTIVE",
          account: freshAccount,
        });
      }

      const error = await parseGraphError(response, "Unable to verify Facebook account.");
      if (isAuthExpiredError(error)) {
        return authCheckResultSchema.parse({ active: false });
      }
      // Transient Graph API hiccup: conservatively report active so the
      // publisher attempts the real call; auth-correctness is enforced at
      // publish time.
      return authCheckResultSchema.parse({
        active: freshAccount.status === "ACTIVE",
        account: freshAccount,
      });
    } catch (error) {
      console.error("Facebook auth check failed.", { accountId: account.id, error });
      return authCheckResultSchema.parse({ active: false });
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

    let account: SocialAccount;
    let token: string;
    let pageIdValue: string;
    try {
      account = await this.ensureFreshToken(input.account);
      token = this.deps.decryptToken(account.accessToken);
      pageIdValue = platformUserId(account);
    } catch {
      return publishResultSchema.parse({
        ok: false,
        error: "Reconnect your Facebook account to publish this target.",
        authExpired: true,
        retryable: false,
      });
    }

    // Touch config so misconfiguration surfaces rather than silent failures.
    this.deps.loadMetaConfig();

    const url = new URL(
      `https://graph.facebook.com/${graphVersion()}/${pageIdValue}/feed`,
    );
    url.searchParams.set("message", input.text);
    url.searchParams.set("access_token", token);

    let response: Response;
    try {
      response = await this.fetchFn(url, { method: "POST" });
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

export const realFacebookAdapter = new RealFacebookAdapter();