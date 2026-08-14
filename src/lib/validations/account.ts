import { z } from "zod";
import { PLATFORMS } from "@/lib/platforms/constraints";

export const connectAccountSchema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().trim().min(1, "Handle is required"),
});

export const accountIdParamsSchema = z.object({
  id: z.string().cuid("Account ID must be valid"),
});

export type ConnectAccountInput = z.infer<typeof connectAccountSchema>;
export type AccountIdParams = z.infer<typeof accountIdParamsSchema>;
