import { LocalMediaStorage } from "./local";
import { VercelBlobMediaStorage } from "./blob";
import type { MediaStorage } from "./types";

/**
 * Resolve the active MediaStorage implementation from environment config.
 *
 * - When `BLOB_READ_WRITE_TOKEN` is set, returns the Vercel Blob backed impl,
 *   which produces publicly-fetchable URLs required by Meta's Instagram
 *   Graph API (Meta's crawler must be able to fetch the image URL).
 * - Otherwise returns the local-disk impl (`/uploads`) for dev. Local URLs are
 *   server-rendered as `{origin}/api/uploads/{fileName}` and auth-gated, so
 *   they cannot satisfy Instagram publishing — non-IG flows still work.
 *
 * Gated by env on purpose (per AGENTS.md): no behavior change for existing
 * non-IG flows until Blob is configured.
 */
export function getMediaStorage(): MediaStorage {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return new VercelBlobMediaStorage();
  }
  return new LocalMediaStorage();
}