import { z } from "zod";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_MESSAGE = "Files must be 25 MB or smaller.";

export function isWithinUploadSizeLimit(sizeBytes: number): boolean {
  return sizeBytes <= MAX_UPLOAD_BYTES;
}

export const uploadResponseSchema = z.object({
  media: z.object({
    url: z.string().url(),
    type: z.enum(["IMAGE", "VIDEO"]),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
  }).strict(),
}).strict();

export type UploadResponse = z.infer<typeof uploadResponseSchema>;
