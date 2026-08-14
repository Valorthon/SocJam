export interface SaveMediaInput {
  bytes: Uint8Array;
  mimeType: string;
}

export interface StoredMedia {
  fileName: string;
}

export interface LoadedMedia {
  bytes: Uint8Array;
  mimeType: string;
}

export interface MediaStorage {
  save(input: SaveMediaInput): Promise<StoredMedia>;
  load(fileName: string): Promise<LoadedMedia | null>;
}
