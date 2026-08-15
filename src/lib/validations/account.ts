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

// OAuth (Phase 2a — Meta). All schemas are shared by client and server.
export const metaPageSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    hasInstagram: z.boolean().default(false),
  })
  .strict();

export type MetaPage = z.infer<typeof metaPageSchema>;

export const metaPageListResponseSchema = z
  .object({
    pages: z.array(metaPageSchema),
    platform: z.enum(["FACEBOOK", "INSTAGRAM"]),
  })
  .strict();

export type MetaPageListResponse = z.infer<typeof metaPageListResponseSchema>;

export const finalizeOauthSchema = z
  .object({
    pageId: z.string().min(1),
  })
  .strict();

export const connectModeResponseSchema = z
  .object({
    // Map of platform -> "real" | "mock". Resolved server-side (env vars and
    // OAuth credentials are not exposed to the browser).
    modes: z.record(z.enum(PLATFORMS), z.enum(["real", "mock"])),
  })
  .strict();

export type ConnectModeResponse = z.infer<typeof connectModeResponseSchema>;