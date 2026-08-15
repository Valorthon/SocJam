import { z } from "zod";
export { validationErrorSchema } from "@/lib/validations/common";
export type { ValidationErrorResponse } from "@/lib/validations/common";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_SIZE_MESSAGE } from "@/lib/validations/upload";

export const postTargetInputSchema = z.object({
  accountId: z.string().trim().min(1, "Account is required"),
  adaptedText: z.string().trim().min(1, "Adapted text cannot be empty").optional(),
});

export const mediaInputSchema = z.object({
  url: z.string().url("Media URL must be valid"),
  type: z.enum(["IMAGE", "VIDEO"]),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().nonnegative().max(MAX_UPLOAD_BYTES, MAX_UPLOAD_SIZE_MESSAGE),
  width: z.number().int().nonnegative().nullable().optional(),
  height: z.number().int().nonnegative().nullable().optional(),
  order: z.number().int().nonnegative(),
});

export const createPostSchema = z
  .object({
    idempotencyKey: z.string().uuid("Idempotency key must be a UUID"),
    baseText: z.string().trim().min(1, "Base text is required"),
    targets: z.array(postTargetInputSchema).min(1, "Select at least one account"),
    media: z.array(mediaInputSchema).default([]),
    scheduledAt: z.iso.datetime().nullable().optional(),
  })
  .superRefine((data, context) => {
    const accountIds = new Set<string>();

    data.targets.forEach((target, index) => {
      if (accountIds.has(target.accountId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each account can only be selected once",
          path: ["targets", index, "accountId"],
        });
      }

      accountIds.add(target.accountId);
    });
  })
  .transform((data) => ({
    ...data,
    targets: data.targets.map((target) => ({
      ...target,
      adaptedText: target.adaptedText ?? data.baseText,
    })),
  }));

export const saveDraftSchema = z
  .object({
    idempotencyKey: z.string().uuid("Idempotency key must be a UUID"),
    baseText: z.string(),
    targets: z.array(
      z.object({
        accountId: z.string().trim().min(1, "Account is required"),
        adaptedText: z.string(),
      }),
    ),
    media: z.array(mediaInputSchema).default([]),
  })
  .superRefine((data, context) => {
    const accountIds = new Set<string>();

    data.targets.forEach((target, index) => {
      if (accountIds.has(target.accountId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each account can only be selected once",
          path: ["targets", index, "accountId"],
        });
      }

      accountIds.add(target.accountId);
    });
  });

export const postIdParamsSchema = z.object({
  id: z.string().cuid("Post ID must be valid"),
});

export type PostTargetInput = z.infer<typeof postTargetInputSchema>;
export type MediaInput = z.infer<typeof mediaInputSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
export type PostIdParams = z.infer<typeof postIdParamsSchema>;
