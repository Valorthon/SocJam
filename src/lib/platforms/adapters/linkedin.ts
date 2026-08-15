import { readFile } from "node:fs/promises";
import path from "node:path";
import type { MediaAsset, PostTarget, SocialAccount } from "@prisma/client";
import { z } from "zod";
import {
  getConstraints,
  validatePost as validatePlatformPost,
} from "@/lib/platforms/constraints";
import {
  buildMemberUrn,
  exchangeCodeForToken,
  fetchMemberProfile,
  refreshAccessToken,
} from "@/lib/platforms/oauth/linkedin";
import type {
  AnalyticsResult,
  AuthCheckResult,
  PublishInput,
  PublishResult,
  SocialPlatformAdapter,
} from "@/lib/platforms/types";
import { analyticsResultSchema, authCheckResultSchema, publishResultSchema } from "@/lib/platforms/types";
import { decryptToken, encryptToken } from "@/lib/tokens/crypto";

const LINKEDIN_POSTS_URL = "https://api.linkedin.com/rest/posts";
const LINKEDIN_REGISTER_UPLOAD_URL = "https://api.linkedin.com/v2/assets?action=registerUpload";
const LINKEDIN_API_VERSION_DEFAULT = "202607";

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

const registerUploadResponseSchema = z.object({
  value: z.object({
    asset: z.string(),
    uploadMechanism: z.object({
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": z.object({
        uploadUrl: z.string().url(),
        headers: z.record(z.string(), z.string()).optional(),
      }),
    }),
  }),
});

const createPostResponseSchema = z.object({
  id: z.string().optional(),
});

export interface LinkedInAdapterDependencies {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiVersion: string;
  exchangeCodeForToken: typeof exchangeCodeForToken;
  fetchMemberProfile: typeof fetchMemberProfile;
  refreshAccessToken: typeof refreshAccessToken;
  decryptToken: typeof decryptToken;
  encryptToken: typeof encryptToken;
  uploadDir: string;
  fetch?: typeof fetch;
  now?: () => Date;
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
    return fileName && /^[0-9a-f-]{36}\.(gif|jpg|jpeg|png|webp|mp4|webm)$/i.test(fileName)
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
    gif: "image/gif",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return map[extension] ?? null;
}

function buildIdempotencyKey(targetId: string, idempotencyKey: string): string {
  return `${targetId}:${idempotencyKey}`;
}

function linkedInErrorFromResponse(status: number, data: unknown): {
  message: string;
  authExpired: boolean;
  retryable: boolean;
} {
  const message =
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof data.message === "string"
      ? data.message
      : `LinkedIn API returned ${status}.`;

  const authExpired = status === 401;
  const retryable = status >= 500 || status === 429 || status === 0;

  return { message, authExpired, retryable };
}

export class LinkedInAdapter implements SocialPlatformAdapter {
  readonly platform = "LINKEDIN" as const;
  private readonly dependencies: LinkedInAdapterDependencies;
  private readonly fetch: typeof globalThis.fetch;
  private readonly now: () => Date;

  constructor(dependencies: Partial<LinkedInAdapterDependencies> = {}) {
    this.dependencies = {
      clientId: dependencies.clientId ?? process.env.LINKEDIN_CLIENT_ID ?? "",
      clientSecret: dependencies.clientSecret ?? process.env.LINKEDIN_CLIENT_SECRET ?? "",
      redirectUri:
        dependencies.redirectUri ??
        process.env.LINKEDIN_REDIRECT_URI ??
        "http://localhost:3000/api/accounts/oauth/linkedin/callback",
      apiVersion:
        dependencies.apiVersion ??
        process.env.LINKEDIN_API_VERSION ??
        LINKEDIN_API_VERSION_DEFAULT,
      exchangeCodeForToken: dependencies.exchangeCodeForToken ?? exchangeCodeForToken,
      fetchMemberProfile: dependencies.fetchMemberProfile ?? fetchMemberProfile,
      refreshAccessToken: dependencies.refreshAccessToken ?? refreshAccessToken,
      decryptToken: dependencies.decryptToken ?? decryptToken,
      encryptToken: dependencies.encryptToken ?? encryptToken,
      uploadDir: dependencies.uploadDir ?? getUploadDir(),
      fetch: dependencies.fetch ?? getFetch(),
      now: dependencies.now ?? (() => new Date()),
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
      console.error("LinkedIn auth check failed.", { accountId: account.id, error });
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

    const account = await this.ensureFreshToken(input.account);
    const accessToken = this.dependencies.decryptToken(account.accessToken);
    const authorUrn = account.platformUserId;
    if (!authorUrn) {
      return publishResultSchema.parse({
        ok: false,
        error: "LinkedIn member profile is missing. Reconnect your account.",
        authExpired: true,
        retryable: false,
      });
    }

    try {
      const publishedUrl = await this.createLinkedInPost({
        accessToken,
        authorUrn,
        text: input.text,
        media: input.media,
        idempotencyKey: buildIdempotencyKey(input.targetId, input.idempotencyKey),
      });

      return publishResultSchema.parse({
        ok: true,
        publishedUrl,
      });
    } catch (error) {
      console.error("LinkedIn publish failed.", { targetId: input.targetId, error });
      const message = error instanceof Error ? error.message : "Unable to publish to LinkedIn.";
      const authExpired = message.toLowerCase().includes("unauthorized") || message.includes("401");
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
    // LinkedIn does not expose organic analytics for personal shares via the
    // public API. Returning explicit zeros keeps the interface contract while
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
    codeVerifier: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    scope?: string;
    platformUserId: string;
    handle: string;
  }> {
    const token = await this.dependencies.exchangeCodeForToken({
      clientId: this.dependencies.clientId,
      clientSecret: this.dependencies.clientSecret,
      redirectUri: this.dependencies.redirectUri,
      code,
      codeVerifier,
    });

    const profile = await this.dependencies.fetchMemberProfile(token.access_token);
    const expiresAt = token.expires_in
      ? new Date(this.now().getTime() + token.expires_in * 1000)
      : undefined;

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope: token.scope,
      platformUserId: buildMemberUrn(profile.sub),
      handle: profile.name ?? profile.email ?? profile.sub,
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
      clientId: this.dependencies.clientId,
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

  private async createLinkedInPost(input: {
    accessToken: string;
    authorUrn: string;
    text: string;
    media: MediaAsset[];
    idempotencyKey: string;
  }): Promise<string> {
    const images = input.media.filter((asset) => asset.type === "IMAGE");
    const imageAssetUrns: string[] = [];

    for (const image of images.slice(0, this.getConstraints().maxImages)) {
      const assetUrn = await this.uploadImage(input.accessToken, input.authorUrn, image);
      imageAssetUrns.push(assetUrn);
    }

    const body: Record<string, unknown> = {
      author: input.authorUrn,
      commentary: input.text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };

    if (imageAssetUrns.length === 1) {
      body.content = {
        media: { id: imageAssetUrns[0] },
      };
    } else if (imageAssetUrns.length > 1) {
      body.content = {
        multiImage: {
          images: imageAssetUrns.map((id) => ({ id })),
        },
      };
    }

    const response = await this.fetch(LINKEDIN_POSTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "LinkedIn-Version": this.dependencies.apiVersion,
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    const data: unknown = await response.json().catch(() => ({}));

    if (!response.ok) {
      const { message, authExpired, retryable } = linkedInErrorFromResponse(
        response.status,
        data,
      );
      const error = new Error(message);
      (error as Error & { authExpired?: boolean; retryable?: boolean }).authExpired =
        authExpired;
      (error as Error & { authExpired?: boolean; retryable?: boolean }).retryable = retryable;
      throw error;
    }

    const restliId = response.headers.get("x-restli-id");
    const parsed = createPostResponseSchema.parse(data);
    const postId = restliId ?? parsed.id;
    return postId ? `https://www.linkedin.com/feed/update/${postId}` : "https://www.linkedin.com";
  }

  private async uploadImage(
    accessToken: string,
    authorUrn: string,
    image: MediaAsset,
  ): Promise<string> {
    const loaded = await loadMediaFromDisk(image.url, this.dependencies.uploadDir);
    if (!loaded) {
      throw new Error(`Unable to load image for upload: ${image.url}`);
    }

    const registerResponse = await this.fetch(LINKEDIN_REGISTER_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: authorUrn,
          serviceRelationships: [
            {
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            },
          ],
        },
      }),
    });

    const registerData: unknown = await registerResponse.json();
    if (!registerResponse.ok) {
      const { message } = linkedInErrorFromResponse(registerResponse.status, registerData);
      throw new Error(message);
    }

    const {
      value: {
        asset,
        uploadMechanism: {
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": { uploadUrl },
        },
      },
    } = registerUploadResponseSchema.parse(registerData);

    const uploadResponse = await this.fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": loaded.mimeType },
      body: new Uint8Array(loaded.bytes),
    });

    if (!uploadResponse.ok) {
      throw new Error(`LinkedIn image upload failed: ${uploadResponse.status}`);
    }

    return asset;
  }
}

export const linkedInAdapter = new LinkedInAdapter();
