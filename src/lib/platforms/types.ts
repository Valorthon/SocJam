import type { MediaAsset, PostTarget, SocialAccount } from "@prisma/client";
import { z } from "zod";
import type { Platform } from "./constraints";

export type { Platform } from "./constraints";

export interface PlatformConstraints {
  maxChars: number;
  maxImages: number;
  requiresImage: boolean;
  requiresVideo: boolean;
  maxVideoSeconds: number;
  maxFileSizeMB: number;
  supportedMediaTypes: string[];
}

export interface PublishInput {
  targetId: string;
  idempotencyKey: string;
  text: string;
  media: MediaAsset[];
  account: SocialAccount;
}

export const publishResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    publishedUrl: z.string().url(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
    authExpired: z.boolean().optional(),
    retryable: z.boolean(),
  }),
]);

export const authCheckResultSchema = z.object({
  active: z.boolean(),
});

export const analyticsResultSchema = z.object({
  impressions: z.number().int().nonnegative(),
  likes: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  shares: z.number().int().nonnegative(),
});

export type PublishResult = z.infer<typeof publishResultSchema>;
export type AuthCheckResult = z.infer<typeof authCheckResultSchema>;
export type AnalyticsResult = z.infer<typeof analyticsResultSchema>;

export interface SocialPlatformAdapter {
  readonly platform: Platform;
  getConstraints(): PlatformConstraints;
  validatePost(input: PublishInput): { valid: boolean; errors: string[] };
  publishPost(input: PublishInput): Promise<PublishResult>;
  checkAuth(account: SocialAccount): Promise<AuthCheckResult>;
  fetchAnalytics(target: PostTarget): Promise<AnalyticsResult>;
}
