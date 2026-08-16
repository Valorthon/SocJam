export interface SaveMediaInput {
  bytes: Uint8Array;
  mimeType: string;
}

export interface StoredMedia {
  fileName: string;
  /**
   * Persistent publicly-fetchable URL for the stored media. Present only when
   * the underlying storage exposes one (e.g. Vercel Blob). When absent the
   * route handler synthesizes a local URL rooted at `/api/uploads/`. Meta's
   * Instagram Graph API requires this URL to be reachable by Meta's crawler,
   * so Instagram-bound uploads must come from a storage impl that sets it.
   */
  publicUrl?: string;
}

export interface LoadedMedia {
  bytes: Uint8Array;
  mimeType: string;
}

export interface MediaStorage {
  save(input: SaveMediaInput): Promise<StoredMedia>;
  load(fileName: string): Promise<LoadedMedia | null>;
}
