import { randomUUID } from "node:crypto";

import { put, type PutBlobResult } from "@vercel/blob";

import type { LoadedMedia, MediaStorage, SaveMediaInput, StoredMedia } from "./types";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

function extensionForMimeType(mimeType: string): string | null {
  return MIME_EXTENSIONS[mimeType] ?? null;
}

/**
 * Vercel Blob-backed MediaStorage. Stores are public-read by default, so the
 * `save()` result carries a `publicUrl` that Meta's Instagram crawler (and any
 * other platform needing a fetchable media URL) can reach. This is the storage
 * used once `BLOB_READ_WRITE_TOKEN` is configured; otherwise the local-disk
 * impl remains in effect for dev.
 */
export interface VercelBlobMediaStorageDependencies {
  put: typeof put;
  token?: string;
}

export class VercelBlobMediaStorage implements MediaStorage {
  private readonly deps: VercelBlobMediaStorageDependencies;

  constructor(dependencies: Partial<VercelBlobMediaStorageDependencies> = {}) {
    this.deps = {
      put: dependencies.put ?? put,
      token: dependencies.token ?? process.env.BLOB_READ_WRITE_TOKEN,
    };
  }

  async save(input: SaveMediaInput): Promise<StoredMedia> {
    const extension = extensionForMimeType(input.mimeType);
    if (!extension) {
      throw new Error("Unsupported media type.");
    }

    const fileName = `${randomUUID()}.${extension}`;
    // Vercel Blob's PutBody accepts Buffer (among others); copy the bytes into
    // a Node Buffer so the upload is independent of the caller's Uint8Array view.
    const body = Buffer.from(input.bytes);
    const blob: PutBlobResult = await this.deps.put(fileName, body, {
      access: "public",
      addRandomSuffix: false,
      token: this.deps.token,
    });

    return { fileName, publicUrl: blob.url };
  }

  async load(_fileName: string): Promise<LoadedMedia | null> {
    // Blob storage is addressed by its public URL rather than a fileName, so
    // byte-level `load` is not supported through this interface. The public
    // URL returned by `save` is the canonical access path (e.g. Meta fetches
    // media via that URL); clients never call the GET /api/uploads route for
    // Blob-backed uploads. Return null to satisfy the contract.
    return null;
  }
}