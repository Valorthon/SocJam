import { z } from "zod";

export const validationErrorSchema = z.object({
  error: z.string(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
});

export type ValidationErrorResponse = z.infer<typeof validationErrorSchema>;
