import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Shared media-byte loader for real platform adapters.
 *
 * Resolves a media `url` to its raw bytes + MIME type, supporting both the
 * local-disk dev path (`/api/uploads/{uuid}.{ext}` served from `UPLOAD_DIR`)
 * and any publicly-fetchable URL (Vercel Blob, S3, etc. — the production path).
 *
 * In production, uploads are stored behind `MediaStorage` implementations that
 * return public URLs (see `src/lib/storage`), so adapters must fetch the bytes
 * over HTTP rather than reading from disk. Returning `null` for a missing
 * file / non-2xx fetch lets each adapter surface its own "Unable to load
 * media" error; unexpected I/O errors propagate so the adapter can classify
 * them (e.g. as retryable network failures).
 *
 * Kept platform-agnostic by design — Instagram / Facebook / LinkedIn video
 * work can reuse this without changes.
 */

const EXTENSION_MIME_TYPES: Record<string, string> = {
  gif: "image/gif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

const SUPPORTED_MIME_TYPES = new Set(Object.values(EXTENSION_MIME_TYPES));

const LOCAL_UPLOAD_PATH = /^\/api\/uploads\/[0-9a-f-]{36}\.(gif|jpg|jpeg|png|webp|mp4|webm|mov)$/i;

const DEFAULT_UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

export interface LoadedMedia {
  bytes: Buffer;
  mimeType: string;
}

function resolveUploadDir(uploadDir?: string): string {
  return path.resolve(uploadDir ?? DEFAULT_UPLOAD_DIR);
}

function extensionToMimeType(extension: string): string | null {
  return EXTENSION_MIME_TYPES[extension.toLowerCase()] ?? null;
}

function fileNameFromLocalPath(pathname: string): string {
  return pathname.split("/").pop() ?? "";
}

function isLocalUploadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return LOCAL_UPLOAD_PATH.test(parsed.pathname);
  } catch {
    return false;
  }
}

async function loadFromDisk(
  url: string,
  uploadDir: string,
): Promise<LoadedMedia | null> {
  const fileName = fileNameFromLocalPath(new URL(url).pathname);
  if (!fileName) return null;

  const extension = path.extname(fileName).slice(1);
  const mimeType = extensionToMimeType(extension);
  if (!mimeType) return null;

  try {
    const bytes = await readFile(path.join(uploadDir, fileName));
    return { bytes, mimeType };
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function mimeTypeFromResponse(
  response: Response,
  url: string,
): string | null {
  const contentType = response.headers.get("content-type");
  let mimeType =
    contentType?.split(";")[0]?.trim().toLowerCase() ?? "";

  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    const extension = path.extname(new URL(url).pathname).slice(1);
    const inferred = extensionToMimeType(extension);
    if (inferred) {
      mimeType = inferred;
    } else {
      return null;
    }
  }

  return mimeType || null;
}

async function loadFromHttp(
  url: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<LoadedMedia | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "GET",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return null;
  }

  const mimeType = mimeTypeFromResponse(response, url);
  if (!mimeType) {
    return null;
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, mimeType };
}

/**
 * Resolve `url` to its raw bytes + MIME type.
 *
 * - URLs whose pathname matches `/api/uploads/{uuid}.{ext}` are read from the
 *   local `UPLOAD_DIR` (dev path — auth-gated and on localhost in prod).
 * - Any other URL is fetched over HTTP (production Blob / S3 / public CDN).
 *
 * Returns `null` when the media is missing, not a supported type, or the
 * remote responds non-2xx; throws on unexpected I/O / network errors so the
 * caller can classify them (e.g. retryable).
 */
export async function loadMediaFromUrl(
  url: string,
  options: {
    uploadDir?: string;
    fetch?: typeof fetch;
    fetchTimeoutMs?: number;
  } = {},
): Promise<LoadedMedia | null> {
  if (isLocalUploadUrl(url)) {
    return loadFromDisk(url, resolveUploadDir(options.uploadDir));
  }
  return loadFromHttp(url, options.fetch, options.fetchTimeoutMs);
}