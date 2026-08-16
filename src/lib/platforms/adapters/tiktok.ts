import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MediaAsset, PostTarget, SocialAccount } from "@prisma/client";
import { z } from "zod";
import {
  getConstraints,
  validatePost as validatePlatformPost,
} from "@/lib/platforms/constraints";
import {
  exchangeCodeForToken,
  fetchCreatorInfo,
  refreshAccessToken,
  type TikTokCreatorInfoResponse,
  type TikTokTokenResponse,
} from "@/lib/platforms/oauth/tiktok";
import type {
  AnalyticsResult,
  AuthCheckResult,
  PublishInput,
  PublishResult,
  SocialPlatformAdapter,
} from "@/lib/platforms/types";
import { analyticsResultSchema, authCheckResultSchema, publishResultSchema } from "@/lib/platforms/types";
import { decryptToken, encryptToken } from "@/lib/tokens/crypto";

const TIKTOK_PUBLISH_VIDEO_INIT_URL =
  "https://open.tiktokapis.com/v2/post/publish/video/init/";
const TIKTOK_PUBLISH_STATUS_FETCH_URL =
  "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1000;

export const TIKTOK_POLL_INTERVAL_MS = POLL_INTERVAL_MS;
export const TIKTOK_MAX_POLL_DURATION_MS = MAX_POLL_DURATION_MS;

const initResponseSchema = z.object({
  data: z.object({
    publish_id: z.string(),
    upload_url: z.string().url(),
  }),
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
    log_id: z.string().optional(),
  }),
});

const statusResponseSchema = z.object({
  data: z.object({
    status: z.enum([
      "PROCESSING_UPLOAD",
      "PROCESSING_DOWNLOAD",
      "SEND_TO_USER_INBOX",
      "PUBLISH_COMPLETE",
      "FAILED",
    ]),
    fail_reason: z.string().optional(),
    publicaly_available_post_id: z.array(z.string()).optional(),
    uploaded_bytes: z.number().optional(),
    downloaded_bytes: z.number().optional(),
  }),
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
    log_id: z.string().optional(),
  }),
});

type TikTokPublishStatus = z.infer<typeof statusResponseSchema>["data"];

export interface TikTokAdapterDependencies {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  exchangeCodeForToken: typeof exchangeCodeForToken;
  refreshAccessToken: typeof refreshAccessToken;
  fetchCreatorInfo: typeof fetchCreatorInfo;
  decryptToken: typeof decryptToken;
  encryptToken: typeof encryptToken;
  uploadDir: string;
  fetch?: typeof fetch;
  now?: () => Date;
  pollIntervalMs?: number;
  maxPollDurationMs?: number;
}

function getUploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
}

function getFetch(): typeof fetch {
  return fetch;
}

function fileNameFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const fileName = pathname.split("/").pop();
    return fileName && /^[0-9a-f-]{36}\.(mp4|webm|mov)$/i.test(fileName)
      ? fileName
      : null;
  } catch {
    return null;
  }
}

async function loadMediaFromDisk(
  url: string,
  uploadDir: string,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const fileName = fileNameFromUrl(url);
  if (!fileName) return null;

  const filePath = path.join(uploadDir, fileName);
  try {
    const bytes = await readFile(filePath);
    const extension = path.extname(fileName).slice(1).toLowerCase();
    const mimeType = extensionToMimeType(extension);
    if (!mimeType) return null;
    return { bytes, mimeType };
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function extensionToMimeType(extension: string): string | null {
  const map: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  return map[extension] ?? null;
}

function isRetryableFailReason(reason: string | undefined): boolean {
  if (!reason) return true;
  const retryableReasons = new Set(["internal", "video_pull_failed", "photo_pull_failed"]);
  return retryableReasons.has(reason);
}

function isAuthExpiredError(status: number, errorCode?: string): boolean {
  if (status === 401) return true;
  return errorCode === "access_token_invalid" || errorCode === "scope_not_authorized";
}

function tiktokApiErrorFromResponse(
  status: number,
  errorCode: string | undefined,
  message: string | undefined,
): { message: string; authExpired: boolean; retryable: boolean } {
  const description = message?.trim()
    ? message
    : `TikTok API returned ${status}.`;
  const authExpired = isAuthExpiredError(status, errorCode);
  const retryable =
    !authExpired && (status >= 500 || status === 429 || errorCode === "internal");
  return { message: description, authExpired, retryable };
}

export class TikTokAdapter implements SocialPlatformAdapter {
  readonly platform = "TIKTOK" as const;
  private readonly dependencies: TikTokAdapterDependencies;
  private readonly fetch: typeof globalThis.fetch;
  private readonly now: () => Date;

  constructor(dependencies: Partial<TikTokAdapterDependencies> = {}) {
    this.dependencies = {
      clientKey: dependencies.clientKey ?? process.env.TIKTOK_CLIENT_KEY ?? "",
      clientSecret:
        dependencies.clientSecret ?? process.env.TIKTOK_CLIENT_SECRET ?? "",
      redirectUri:
        dependencies.redirectUri ??
        process.env.TIKTOK_REDIRECT_URI ??
        "http://localhost:3000/api/accounts/oauth/tiktok/callback",
      exchangeCodeForToken:
        dependencies.exchangeCodeForToken ?? exchangeCodeForToken,
      refreshAccessToken: dependencies.refreshAccessToken ?? refreshAccessToken,
      fetchCreatorInfo: dependencies.fetchCreatorInfo ?? fetchCreatorInfo,
      decryptToken: dependencies.decryptToken ?? decryptToken,
      encryptToken: dependencies.encryptToken ?? encryptToken,
      uploadDir: dependencies.uploadDir ?? getUploadDir(),
      fetch: dependencies.fetch ?? getFetch(),
      now: dependencies.now ?? (() => new Date()),
      pollIntervalMs: dependencies.pollIntervalMs ?? POLL_INTERVAL_MS,
      maxPollDurationMs: dependencies.maxPollDurationMs ?? MAX_POLL_DURATION_MS,
    };
    this.fetch = dependencies.fetch ?? getFetch();
    this.now = dependencies.now ?? (() => new Date());
  }

  getConstraints() {
    return getConstraints(this.platform);
  }

  validatePost(input: PublishInput): { valid: boolean; errors: string[] } {
    return validatePlatformPost(
      this.platform,
      input.text,
      input.media.map((asset) => ({
        type: asset.type,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
      })),
    );
  }

  async checkAuth(account: SocialAccount): Promise<AuthCheckResult> {
    try {
      const freshAccount = await this.ensureFreshToken(account);
      return authCheckResultSchema.parse({
        active: freshAccount.status === "ACTIVE",
        account: freshAccount,
      });
    } catch (error) {
      console.error("TikTok auth check failed.", { accountId: account.id, error });
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

    const video = input.media.find((asset) => asset.type === "VIDEO");
    if (!video) {
      return publishResultSchema.parse({
        ok: false,
        error: "TikTok requires a video.",
        retryable: false,
      });
    }

    const loaded = await loadMediaFromDisk(video.url, this.dependencies.uploadDir);
    if (!loaded) {
      return publishResultSchema.parse({
        ok: false,
        error: "Unable to load video for upload.",
        retryable: false,
      });
    }

    const account = await this.ensureFreshToken(input.account);
    const accessToken = this.dependencies.decryptToken(account.accessToken);

    try {
      const { publishId, uploadUrl } = await this.initializeVideoUpload({
        accessToken,
        title: input.text,
        videoSize: loaded.bytes.length,
      });

      await this.uploadVideoFile(uploadUrl, loaded.bytes, loaded.mimeType);

      const finalStatus = await this.pollPublishStatus(accessToken, publishId);

      if (finalStatus.status === "PUBLISH_COMPLETE") {
        const publishedUrl = account.handle
          ? `https://www.tiktok.com/@${account.handle}`
          : "https://www.tiktok.com";
        return publishResultSchema.parse({ ok: true, publishedUrl });
      }

      const failReason = finalStatus.fail_reason ?? "unknown";
      const { message, authExpired, retryable } = tiktokApiErrorFromResponse(
        200,
        failReason,
        `TikTok publish failed: ${failReason}`,
      );
      return publishResultSchema.parse({
        ok: false,
        error: message,
        authExpired,
        retryable: isRetryableFailReason(failReason) && retryable,
      });
    } catch (error) {
      console.error("TikTok publish failed.", { targetId: input.targetId, error });
      const message = error instanceof Error ? error.message : "Unable to publish to TikTok.";
      const authExpired =
        message.toLowerCase().includes("unauthorized") || message.includes("401");
      const retryable = !authExpired && !message.toLowerCase().includes("validation");
      return publishResultSchema.parse({
        ok: false,
        error: message,
        authExpired,
        retryable,
      });
    }
  }

  async fetchAnalytics(_target: PostTarget): Promise<AnalyticsResult> {
    // TikTok's Content Posting API does not expose organic analytics for
    // individual posts. Returning zeros keeps the interface contract while
    // surfacing the limitation in the UI.
    return analyticsResultSchema.parse({
      impressions: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    });
  }

  async connectFromCode(
    code: string,
    codeVerifier?: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string;
    platformUserId: string;
    handle: string;
  }> {
    const token = await this.dependencies.exchangeCodeForToken({
      clientKey: this.dependencies.clientKey,
      clientSecret: this.dependencies.clientSecret,
      redirectUri: this.dependencies.redirectUri,
      code,
      codeVerifier,
    });

    const creatorInfo = await this.dependencies.fetchCreatorInfo(token.access_token);
    const expiresAt = token.expires_in
      ? new Date(this.now().getTime() + token.expires_in * 1000)
      : undefined;

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope: token.scope,
      platformUserId: token.open_id,
      handle: creatorInfo.creator_username,
    };
  }

  private async ensureFreshToken(account: SocialAccount): Promise<SocialAccount> {
    const { decryptToken: decrypt, encryptToken: encrypt } = this.dependencies;
    const accessToken = decrypt(account.accessToken);
    const refreshToken = account.refreshToken ? decrypt(account.refreshToken) : null;

    const isExpired =
      account.expiresAt !== null &&
      account.expiresAt.getTime() - TOKEN_EXPIRY_BUFFER_MS <= this.now().getTime();

    if (!isExpired || !refreshToken) {
      return account;
    }

    const refreshed = await this.dependencies.refreshAccessToken({
      clientKey: this.dependencies.clientKey,
      clientSecret: this.dependencies.clientSecret,
      refreshToken,
    });

    const newExpiresAt = refreshed.expires_in
      ? new Date(this.now().getTime() + refreshed.expires_in * 1000)
      : account.expiresAt;

    const encryptedAccessToken = encrypt(refreshed.access_token);
    const encryptedRefreshToken = refreshed.refresh_token
      ? encrypt(refreshed.refresh_token)
      : account.refreshToken;

    const { db } = await import("@/lib/db");
    const updated = await db.socialAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: newExpiresAt,
        scope: refreshed.scope ?? account.scope,
        status: "ACTIVE",
      },
    });

    return updated;
  }

  private async initializeVideoUpload(input: {
    accessToken: string;
    title: string;
    videoSize: number;
  }): Promise<{ publishId: string; uploadUrl: string }> {
    const chunkSize = input.videoSize;
    const totalChunkCount = 1;

    const response = await this.fetch(TIKTOK_PUBLISH_VIDEO_INIT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: input.title,
          privacy_level: "SELF_ONLY",
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: input.videoSize,
          chunk_size: chunkSize,
          total_chunk_count: totalChunkCount,
        },
      }),
    });

    const data: unknown = await response.json();
    if (!response.ok) {
      const parsed = initResponseSchema.safeParse(data);
      const errorCode = parsed.success ? parsed.data.error.code : undefined;
      const message = parsed.success
        ? parsed.data.error.message
        : `TikTok video init failed: ${response.status}`;
      const { message: safeMessage, authExpired, retryable } = tiktokApiErrorFromResponse(
        response.status,
        errorCode,
        message,
      );
      const error = new Error(safeMessage);
      (error as Error & { authExpired?: boolean; retryable?: boolean }).authExpired = authExpired;
      (error as Error & { authExpired?: boolean; retryable?: boolean }).retryable = retryable;
      throw error;
    }

    const parsed = initResponseSchema.parse(data);
    if (parsed.error.code !== "ok") {
      throw new Error(
        `TikTok video init failed: ${parsed.error.code}${parsed.error.message ? ` - ${parsed.error.message}` : ""}`,
      );
    }

    return { publishId: parsed.data.publish_id, uploadUrl: parsed.data.upload_url };
  }

  private async uploadVideoFile(
    uploadUrl: string,
    bytes: Buffer,
    mimeType: string,
  ): Promise<void> {
    const size = bytes.length;
    const response = await this.fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(size),
        "Content-Range": `bytes 0-${size - 1}/${size}`,
      },
      body: new Uint8Array(bytes),
    });

    if (!response.ok) {
      throw new Error(`TikTok video upload failed: ${response.status}`);
    }
  }

  private async pollPublishStatus(
    accessToken: string,
    publishId: string,
  ): Promise<TikTokPublishStatus> {
    const deadline = this.now().getTime() + this.dependencies.maxPollDurationMs!;

    while (this.now().getTime() < deadline) {
      const response = await this.fetch(TIKTOK_PUBLISH_STATUS_FETCH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ publish_id: publishId }),
      });

      const data: unknown = await response.json();
      if (!response.ok) {
        const parsed = statusResponseSchema.safeParse(data);
        const errorCode = parsed.success ? parsed.data.error.code : undefined;
        const message = parsed.success
          ? parsed.data.error.message
          : `TikTok status fetch failed: ${response.status}`;
        const { message: safeMessage, authExpired, retryable } = tiktokApiErrorFromResponse(
          response.status,
          errorCode,
          message,
        );
        const error = new Error(safeMessage);
        (error as Error & { authExpired?: boolean; retryable?: boolean }).authExpired =
          authExpired;
        (error as Error & { authExpired?: boolean; retryable?: boolean }).retryable = retryable;
        throw error;
      }

      const parsed = statusResponseSchema.parse(data);
      if (parsed.error.code !== "ok") {
        throw new Error(
          `TikTok status fetch failed: ${parsed.error.code}${parsed.error.message ? ` - ${parsed.error.message}` : ""}`,
        );
      }

      const status = parsed.data.status;
      if (status === "PUBLISH_COMPLETE" || status === "FAILED") {
        return parsed.data;
      }

      await this.delay(this.dependencies.pollIntervalMs!);
    }

    throw new Error("TikTok publish timed out while waiting for processing to complete.");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const tiktokAdapter = new TikTokAdapter();
