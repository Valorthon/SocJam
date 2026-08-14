import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { LoadedMedia, MediaStorage, SaveMediaInput, StoredMedia } from "./types";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const EXTENSION_MIMES = Object.fromEntries(
  Object.entries(MIME_EXTENSIONS).map(([mimeType, extension]) => [extension, mimeType]),
);

function extensionForMimeType(mimeType: string): string | null {
  return MIME_EXTENSIONS[mimeType] ?? null;
}

function isSafeFileName(fileName: string): boolean {
  return /^[0-9a-f-]{36}\.(gif|jpg|png|webp|mp4|webm)$/.test(fileName);
}

export class LocalMediaStorage implements MediaStorage {
  constructor(
    private readonly directory = path.resolve(process.env.UPLOAD_DIR ?? "./uploads"),
  ) {}

  async save(input: SaveMediaInput): Promise<StoredMedia> {
    const extension = extensionForMimeType(input.mimeType);
    if (!extension) {
      throw new Error("Unsupported media type.");
    }

    const fileName = `${randomUUID()}.${extension}`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(path.join(this.directory, fileName), input.bytes, { flag: "wx" });
    return { fileName };
  }

  async load(fileName: string): Promise<LoadedMedia | null> {
    if (!isSafeFileName(fileName)) {
      return null;
    }

    const extension = path.extname(fileName).slice(1);
    const mimeType = EXTENSION_MIMES[extension];
    if (!mimeType) {
      return null;
    }

    try {
      return { bytes: await readFile(path.join(this.directory, fileName)), mimeType };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }
}
