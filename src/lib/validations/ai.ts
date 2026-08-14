import { z } from "zod";

import { PLATFORMS } from "@/lib/platforms/constraints";

export const COMPOSER_TONES = [
  "professional",
  "casual",
  "playful",
  "bold",
] as const;

export const aiToneSchema = z.enum(COMPOSER_TONES);

export const aiMediaSchema = z.object({
  hasImages: z.boolean().default(false),
  hasVideo: z.boolean().default(false),
});

export const aiAdaptRequestSchema = z
  .object({
    baseText: z.string().trim().min(1, "Base text is required"),
    platforms: z
      .array(z.enum(PLATFORMS))
      .min(1, "Select at least one platform"),
    tone: aiToneSchema.default("professional"),
    media: aiMediaSchema.default({ hasImages: false, hasVideo: false }),
    sharedCaption: z.boolean().default(false),
  })
  .superRefine((data, context) => {
    if (new Set(data.platforms).size !== data.platforms.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each platform can only be selected once",
        path: ["platforms"],
      });
    }
  });

export const aiVariantSchema = z.object({
  platform: z.enum(PLATFORMS),
  text: z.string(),
  valid: z.boolean(),
  errors: z.array(z.string()),
});

export const aiAdaptationQuotaSchema = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  remaining: z.number().int().nonnegative(),
});

export const aiAdaptResponseSchema = z.object({
  variants: z.array(aiVariantSchema),
  model: z.string(),
  quota: aiAdaptationQuotaSchema,
});

export const aiAdaptationQuotaResponseSchema = z.object({
  quota: aiAdaptationQuotaSchema,
});

export type AiTone = z.infer<typeof aiToneSchema>;
export type AiAdaptRequest = z.infer<typeof aiAdaptRequestSchema>;
export type AiVariant = z.infer<typeof aiVariantSchema>;
export type AiAdaptationQuota = z.infer<typeof aiAdaptationQuotaSchema>;
