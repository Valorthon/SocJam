import { z } from "zod";
import { PLATFORMS } from "@/lib/platforms/constraints";

const accountStatuses = ["ACTIVE", "RECONNECT_REQUIRED"] as const;
const postStatuses = [
  "DRAFT",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "PARTIALLY_FAILED",
  "FAILED",
] as const;
const targetStatuses = [
  "DRAFT",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
  "MISSED",
] as const;
const mediaTypes = ["IMAGE", "VIDEO"] as const;

export const socialAccountDtoSchema = z.object({
  id: z.string(),
  platform: z.enum(PLATFORMS),
  handle: z.string(),
  status: z.enum(accountStatuses),
  scheduledTargetCount: z.number().int().nonnegative().default(0),
}).strict();

export const mediaAssetDtoSchema = z.object({
  id: z.string(),
  url: z.string(),
  type: z.enum(mediaTypes),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  order: z.number().int().nonnegative(),
}).strict();

export const postTargetDtoSchema = z.object({
  id: z.string(),
  accountId: z.string().nullable(),
  platform: z.enum(PLATFORMS),
  adaptedText: z.string(),
  status: z.enum(targetStatuses),
  scheduledAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  publishedUrl: z.string().nullable(),
  error: z.string().nullable(),
  attempts: z.number().int().nonnegative(),
  account: socialAccountDtoSchema.nullable(),
}).strict();

export const postTargetSummaryDtoSchema = postTargetDtoSchema.pick({
  id: true,
  accountId: true,
  platform: true,
  status: true,
  publishedUrl: true,
  error: true,
  account: true,
}).strict();

export const postListItemDtoSchema = z.object({
  id: z.string(),
  baseText: z.string(),
  status: z.enum(postStatuses),
  scheduledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  targets: z.array(postTargetSummaryDtoSchema),
}).strict();

export const postDetailDtoSchema = postListItemDtoSchema.extend({
  idempotencyKey: z.string().uuid(),
  targets: z.array(postTargetDtoSchema),
  media: z.array(mediaAssetDtoSchema),
}).strict();

export const accountListResponseSchema = z.object({
  accounts: z.array(socialAccountDtoSchema),
}).strict();

export const accountResponseSchema = z.object({
  account: socialAccountDtoSchema,
}).strict();

export const postListResponseSchema = z.object({
  posts: z.array(postListItemDtoSchema),
}).strict();

export const postDetailResponseSchema = z.object({
  post: postDetailDtoSchema,
}).strict();

export type SocialAccountDto = z.infer<typeof socialAccountDtoSchema>;
export type MediaAssetDto = z.infer<typeof mediaAssetDtoSchema>;
export type PostTargetDto = z.infer<typeof postTargetDtoSchema>;
export type PostTargetSummaryDto = z.infer<typeof postTargetSummaryDtoSchema>;
export type PostListItemDto = z.infer<typeof postListItemDtoSchema>;
export type PostDetailDto = z.infer<typeof postDetailDtoSchema>;
export type AccountListResponse = z.infer<typeof accountListResponseSchema>;
export type AccountResponse = z.infer<typeof accountResponseSchema>;
export type PostListResponse = z.infer<typeof postListResponseSchema>;
export type PostDetailResponse = z.infer<typeof postDetailResponseSchema>;
