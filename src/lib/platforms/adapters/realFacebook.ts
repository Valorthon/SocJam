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
import {
  ensureFreshMetaToken,
  getFetch,
  graphVersion,
  isAuthExpiredError,
  isRateLimited,
  isRetryable,
  parseGraphError,
  platformUserIdOrFail,
  type GraphError,
} from "./metaGraph";

/**
 * Real Meta Graph API adapter for Facebook Page posts.
 *
 * Phase scope:
 *   ✓ Real OAuth connect (encrypted Page access token stored on SocialAccount)
 *   ✓ checkAuth (GET /{page-id}) with opportunistic long-lived token refresh
 *   ✓ publishPost (POST /{page-id}/feed text, /{page-id}/photos single image,
 *     multi-photo carousel via unpublished /photos + /feed attached_media)
 *   ✗ Analytics — throws AnalyticsNotImplementedError (deferred to a future phase)
 *   ✗ Video publishing — text + images only this phase
 *
 * Token model (aligns with main's SocialAccount columns):
 *   accessToken  → encrypted Page access token (used for /feed + /photos POST)
 *   refreshToken → encrypted long-lived user token (refreshable ~60-day window)
 *   expiresAt    → user-token expiry; refreshed opportunistically in checkAuth
 *   platformUserId → Facebook Page ID
 *
 * The publish idempotency envelope is enforced by the publisher (the atomic
 * SCHEDULED → PUBLISHING claim), so this adapter does not dedupe — repeated
 * publishPost calls with the same target will produce repeated platform posts
 * unless the publisher gate blocks them first.
 */

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

  private async ensureFreshToken(account: SocialAccount): Promise<SocialAccount> {
    return ensureFreshMetaToken(account, {
      loadMetaConfig: this.deps.loadMetaConfig,
      refreshUserToken: this.deps.refreshUserToken,
      decryptToken: this.deps.decryptToken,
      encryptToken: this.deps.encryptToken,
      now: this.now,
    });
  }

  async checkAuth(account: SocialAccount): Promise<AuthCheckResult> {
    try {
      const freshAccount = await this.ensureFreshToken(account);
      const token = this.deps.decryptToken(freshAccount.accessToken);
      const pageIdValue = platformUserIdOrFail(freshAccount, "Facebook");

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
      pageIdValue = platformUserIdOrFail(account, "Facebook");
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

    const images = input.media.filter((asset) => asset.type === "IMAGE");

    // Phase scope is text + images only. A post that carries media but no
    // images (e.g. video-only) must fail loudly — silently dropping the
    // media and publishing text would mislead the user.
    if (input.media.length > 0 && images.length === 0) {
      return publishResultSchema.parse({
        ok: false,
        error:
          "Facebook publishing supports text and images only in this phase. Remove the video media and try again.",
        retryable: false,
      });
    }

    try {
      if (images.length === 0) {
        return await this.publishTextPost(pageIdValue, token, input.text);
      }
      if (images.length === 1) {
        return await this.publishSinglePhoto(pageIdValue, token, input.text, images[0].url);
      }
      return await this.publishPhotoCarousel(pageIdValue, token, input.text, images.map((i) => i.url));
    } catch (error) {
      if (error instanceof GraphPublishError) {
        return publishResultSchema.parse({
          ok: false,
          error: sanitizeError(error.graphError),
          authExpired: isAuthExpiredError(error.graphError),
          retryable: isRetryable(error.graphError),
        });
      }
      // Network-level failure — retryable.
      return publishResultSchema.parse({
        ok: false,
        error: "Unable to reach Facebook. Please retry shortly.",
        retryable: true,
      });
    }
  }

  private async postJson(url: URL): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchFn(url, { method: "POST" });
    } catch {
      throw new Error("fetch failed");
    }
    if (!response.ok) {
      const graphError = await parseGraphError(response, "Facebook publishing failed.");
      throw new GraphPublishError(graphError);
    }
    return response.json();
  }

  private async publishTextPost(
    pageId: string,
    token: string,
    text: string,
  ): Promise<PublishResult> {
    const url = new URL(
      `https://graph.facebook.com/${graphVersion()}/${pageId}/feed`,
    );
    url.searchParams.set("message", text);
    url.searchParams.set("access_token", token);

    const body = (await this.postJson(url)) as { id?: string };
    if (typeof body.id === "string" && body.id.length > 0) {
      return publishResultSchema.parse({
        ok: true,
        publishedUrl: buildPublishedUrl(pageId, body.id),
      });
    }
    return publishResultSchema.parse({
      ok: false,
      error: "Facebook accepted the post but did not return a permalink.",
      retryable: true,
    });
  }

  private async publishSinglePhoto(
    pageId: string,
    token: string,
    text: string,
    imageUrl: string,
  ): Promise<PublishResult> {
    const url = new URL(
      `https://graph.facebook.com/${graphVersion()}/${pageId}/photos`,
    );
    url.searchParams.set("url", imageUrl);
    url.searchParams.set("caption", text);
    url.searchParams.set("access_token", token);

    const body = (await this.postJson(url)) as { id?: string; post_id?: string };
    const postId = body.post_id ?? body.id ?? "";
    if (postId.length > 0) {
      return publishResultSchema.parse({
        ok: true,
        publishedUrl: buildPublishedUrl(pageId, postId),
      });
    }
    return publishResultSchema.parse({
      ok: false,
      error: "Facebook accepted the photo but did not return a permalink.",
      retryable: true,
    });
  }

  private async publishPhotoCarousel(
    pageId: string,
    token: string,
    text: string,
    imageUrls: string[],
  ): Promise<PublishResult> {
    // Step 1: upload each photo as an unpublished carousel item, collect fbids.
    const mediaFbids: string[] = [];
    for (const imageUrl of imageUrls) {
      const uploadUrl = new URL(
        `https://graph.facebook.com/${graphVersion()}/${pageId}/photos`,
      );
      uploadUrl.searchParams.set("url", imageUrl);
      uploadUrl.searchParams.set("published", "false");
      uploadUrl.searchParams.set("access_token", token);
      const body = (await this.postJson(uploadUrl)) as { id?: string };
      if (typeof body.id !== "string" || body.id.length === 0) {
        return publishResultSchema.parse({
          ok: false,
          error: "Facebook accepted a carousel item but did not return its id.",
          retryable: true,
        });
      }
      mediaFbids.push(body.id);
    }

    // Step 2: publish the multi-photo post via /feed with attached_media.
    const feedUrl = new URL(
      `https://graph.facebook.com/${graphVersion()}/${pageId}/feed`,
    );
    feedUrl.searchParams.set("message", text);
    feedUrl.searchParams.set("access_token", token);
    mediaFbids.forEach((fbid, index) => {
      feedUrl.searchParams.set(
        `attached_media[${index}]`,
        JSON.stringify({ media_fbid: fbid }),
      );
    });

    const body = (await this.postJson(feedUrl)) as { id?: string };
    if (typeof body.id === "string" && body.id.length > 0) {
      return publishResultSchema.parse({
        ok: true,
        publishedUrl: buildPublishedUrl(pageId, body.id),
      });
    }
    return publishResultSchema.parse({
      ok: false,
      error: "Facebook accepted the carousel but did not return a permalink.",
      retryable: true,
    });
  }

  async fetchAnalytics(_target: PostTarget): Promise<AnalyticsResult> {
    throw new AnalyticsNotImplementedError("Facebook");
  }
}

class GraphPublishError extends Error {
  readonly graphError: GraphError;
  constructor(graphError: GraphError) {
    super(graphError.message);
    this.name = "GraphPublishError";
    this.graphError = graphError;
  }
}

export const realFacebookAdapter = new RealFacebookAdapter();