import type { MediaAsset, PostTarget, SocialAccount } from "@prisma/client";
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
  AnalyticsNotImplementedError,
} from "./realFacebook";
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
 * Real Meta Graph API adapter for Instagram publishing.
 *
 * Phase scope:
 *   ✓ Real OAuth connect (IG business-account id + encrypted Page access token)
 *   ✓ checkAuth (GET /{ig-id}?fields=username)
 *   ✓ publishPost — single image and carousel (up to 10) via the two-step
 *     IG container flow: POST /media → poll status_code → POST /media_publish
 *   ✗ Reels/video — image + image-carousel only this phase
 *   ✗ Analytics — throws AnalyticsNotImplementedError (deferred)
 *
 * Instagram requires every post to include a publicly-fetchable image URL.
 * Meta's servers fetch that URL, so the media must come from a MediaStorage
 * impl that returns a public URL (Vercel Blob). Local-disk /api/uploads URLs
 * are auth-gated and on localhost — Meta cannot fetch them.
 *
 * Token model:
 *   accessToken    → encrypted Page access token (IG container calls use it)
 *   refreshToken   → encrypted long-lived user token (refreshed opportunistically)
 *   platformUserId → Instagram business-account id (the {ig-bus-acct-id})
 */

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_POLL_MAX_ATTEMPTS = 15; // 15 × 2s = 30s ceiling.

export interface RealInstagramAdapterDependencies {
  loadMetaConfig: () => MetaConfig;
  refreshUserToken: typeof refreshUserToken;
  decryptToken: typeof decryptToken;
  encryptToken: typeof encryptToken;
  fetch?: typeof fetch;
  now?: () => Date;
  pollIntervalMs?: number;
  pollMaxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeError(error: GraphError): string {
  if (isAuthExpiredError(error)) {
    return "Reconnect your Instagram account to continue publishing.";
  }
  if (isRateLimited(error)) {
    return "Instagram is rate-limiting this account. Please retry shortly.";
  }
  if (error.status >= 500) {
    return "Instagram is temporarily unavailable. Please retry shortly.";
  }
  // Never leak Meta's raw error body to the UI.
  return "Instagram rejected this post. Check the content and try again.";
}

class GraphPublishError extends Error {
  readonly graphError: GraphError;
  constructor(graphError: GraphError) {
    super(graphError.message);
    this.name = "GraphPublishError";
    this.graphError = graphError;
  }
}

async function readContainerId(body: unknown): Promise<string> {
  const parsed = body as { id?: unknown };
  if (typeof parsed.id === "string" && parsed.id.length > 0) {
    return parsed.id;
  }
  throw new Error("Instagram did not return a container id.");
}

export class RealInstagramAdapter implements SocialPlatformAdapter {
  readonly platform = "INSTAGRAM" as const;
  private readonly deps: Required<RealInstagramAdapterDependencies>;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => Date;

  constructor(dependencies: Partial<RealInstagramAdapterDependencies> = {}) {
    this.deps = {
      loadMetaConfig: dependencies.loadMetaConfig ?? loadMetaConfig,
      refreshUserToken: dependencies.refreshUserToken ?? refreshUserToken,
      decryptToken: dependencies.decryptToken ?? decryptToken,
      encryptToken: dependencies.encryptToken ?? encryptToken,
      fetch: dependencies.fetch ?? getFetch(),
      now: dependencies.now ?? (() => new Date()),
      pollIntervalMs: dependencies.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      pollMaxAttempts: dependencies.pollMaxAttempts ?? DEFAULT_POLL_MAX_ATTEMPTS,
      sleep: dependencies.sleep ?? defaultSleep,
    };
    this.fetchFn = this.deps.fetch;
    this.now = this.deps.now;
  }

  getConstraints() {
    return getConstraints("INSTAGRAM");
  }

  validatePost(input: PublishInput): { valid: boolean; errors: string[] } {
    return validatePlatformPost(
      "INSTAGRAM",
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
      const igId = platformUserIdOrFail(freshAccount, "Instagram");

      const url = new URL(
        `https://graph.facebook.com/${graphVersion()}/${igId}`,
      );
      url.searchParams.set("fields", "username");
      url.searchParams.set("access_token", token);

      const response = await this.fetchFn(url);
      if (response.ok) {
        return authCheckResultSchema.parse({
          active: freshAccount.status === "ACTIVE",
          account: freshAccount,
        });
      }

      const error = await parseGraphError(response, "Unable to verify Instagram account.");
      if (isAuthExpiredError(error)) {
        return authCheckResultSchema.parse({ active: false });
      }
      return authCheckResultSchema.parse({
        active: freshAccount.status === "ACTIVE",
        account: freshAccount,
      });
    } catch (error) {
      console.error("Instagram auth check failed.", { accountId: account.id, error });
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
    let igId: string;
    try {
      account = await this.ensureFreshToken(input.account);
      token = this.deps.decryptToken(account.accessToken);
      igId = platformUserIdOrFail(account, "Instagram");
    } catch {
      return publishResultSchema.parse({
        ok: false,
        error: "Reconnect your Instagram account to publish this target.",
        authExpired: true,
        retryable: false,
      });
    }

    // Touch config so misconfiguration surfaces rather than silent failures.
    this.deps.loadMetaConfig();

    const images = input.media.filter((asset) => asset.type === "IMAGE");

    try {
      let creationId: string;
      if (images.length === 1) {
        creationId = await this.createImageContainer(igId, token, images[0], input.text);
      } else {
        creationId = await this.createCarouselContainer(igId, token, images, input.text);
      }

      const status = await this.pollContainerStatus(creationId, token);
      if (status === "ERROR") {
        return publishResultSchema.parse({
          ok: false,
          error: "Instagram could not process this media. Check the image URL and try again.",
          retryable: true,
        });
      }
      if (status === "TIMEOUT") {
        return publishResultSchema.parse({
          ok: false,
          error: "Instagram is still processing this media. Please retry shortly.",
          retryable: true,
        });
      }

      const mediaId = await this.publishContainer(igId, token, creationId);
      const permalink = await this.fetchPermalink(mediaId, token);
      return publishResultSchema.parse({
        ok: true,
        publishedUrl: permalink,
      });
    } catch (error) {
      if (error instanceof GraphPublishError) {
        return publishResultSchema.parse({
          ok: false,
          error: sanitizeError(error.graphError),
          authExpired: isAuthExpiredError(error.graphError),
          retryable: isRetryable(error.graphError),
        });
      }
      return publishResultSchema.parse({
        ok: false,
        error: "Unable to reach Instagram. Please retry shortly.",
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
      const graphError = await parseGraphError(response, "Instagram publishing failed.");
      throw new GraphPublishError(graphError);
    }
    return response.json();
  }

  private async getJson(url: URL): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchFn(url);
    } catch {
      throw new Error("fetch failed");
    }
    if (!response.ok) {
      const graphError = await parseGraphError(response, "Instagram request failed.");
      throw new GraphPublishError(graphError);
    }
    return response.json();
  }

  private async createImageContainer(
    igId: string,
    token: string,
    image: MediaAsset,
    caption: string,
  ): Promise<string> {
    const url = new URL(
      `https://graph.facebook.com/${graphVersion()}/${igId}/media`,
    );
    url.searchParams.set("image_url", image.url);
    url.searchParams.set("caption", caption);
    url.searchParams.set("access_token", token);
    const body = await this.postJson(url);
    return readContainerId(body);
  }

  private async createCarouselContainer(
    igId: string,
    token: string,
    images: MediaAsset[],
    caption: string,
  ): Promise<string> {
    // Step 1: upload each image as an unpublished carousel item.
    const childIds: string[] = [];
    for (const image of images) {
      const url = new URL(
        `https://graph.facebook.com/${graphVersion()}/${igId}/media`,
      );
      url.searchParams.set("image_url", image.url);
      url.searchParams.set("is_carousel_item", "true");
      url.searchParams.set("access_token", token);
      const body = await this.postJson(url);
      childIds.push(await readContainerId(body));
    }

    // Step 2: create the parent carousel container referencing the children.
    const url = new URL(
      `https://graph.facebook.com/${graphVersion()}/${igId}/media`,
    );
    url.searchParams.set("media_type", "CAROUSEL");
    url.searchParams.set("children", childIds.join(","));
    url.searchParams.set("caption", caption);
    url.searchParams.set("access_token", token);
    const body = await this.postJson(url);
    return readContainerId(body);
  }

  /**
   * Poll the container's `status_code` until it is FINISHED or ERROR, or until
   * the attempt budget is exhausted. Returns "FINISHED", "ERROR", or "TIMEOUT".
   */
  private async pollContainerStatus(
    creationId: string,
    token: string,
  ): Promise<"FINISHED" | "ERROR" | "TIMEOUT"> {
    const url = new URL(
      `https://graph.facebook.com/${graphVersion()}/${creationId}`,
    );
    url.searchParams.set("fields", "status_code");
    url.searchParams.set("access_token", token);

    for (let attempt = 0; attempt < this.deps.pollMaxAttempts; attempt++) {
      if (attempt > 0) {
        await this.deps.sleep(this.deps.pollIntervalMs);
      }
      const body = (await this.getJson(url)) as { status_code?: string };
      const status = body.status_code;
      if (status === "FINISHED") return "FINISHED";
      if (status === "ERROR") return "ERROR";
      // IN_PROGRESS or any other value → keep polling.
    }
    return "TIMEOUT";
  }

  private async publishContainer(
    igId: string,
    token: string,
    creationId: string,
  ): Promise<string> {
    const url = new URL(
      `https://graph.facebook.com/${graphVersion()}/${igId}/media_publish`,
    );
    url.searchParams.set("creation_id", creationId);
    url.searchParams.set("access_token", token);
    const body = await this.postJson(url);
    const parsed = body as { id?: string };
    if (typeof parsed.id !== "string" || parsed.id.length === 0) {
      throw new Error("Instagram accepted the post but did not return a media id.");
    }
    return parsed.id;
  }

  private async fetchPermalink(mediaId: string, token: string): Promise<string> {
    const url = new URL(
      `https://graph.facebook.com/${graphVersion()}/${mediaId}`,
    );
    url.searchParams.set("fields", "permalink");
    url.searchParams.set("access_token", token);
    try {
      const body = (await this.getJson(url)) as { permalink?: string };
      if (typeof body.permalink === "string" && body.permalink.length > 0) {
        return body.permalink;
      }
    } catch {
      // The post is already published — a permalink fetch failure is not a
      // publish failure. Fall through to the best-effort URL below.
    }
    // Best-effort pointer; the post itself was created successfully.
    return `https://www.instagram.com/p/${mediaId}/`;
  }

  async fetchAnalytics(_target: PostTarget): Promise<AnalyticsResult> {
    throw new AnalyticsNotImplementedError("Instagram");
  }
}

export const realInstagramAdapter = new RealInstagramAdapter();