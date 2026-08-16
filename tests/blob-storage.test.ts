import assert from "node:assert/strict";

import { VercelBlobMediaStorage } from "../src/lib/storage/blob";

interface PutArgs {
  pathname: string;
  body: Uint8Array | Buffer;
  options: { access: string; addRandomSuffix: boolean; token?: string };
}

async function run(): Promise<void> {
  const savedPuts: PutArgs[] = [];
  const fakeStoreUrl = "https://omnipost.public.blob.vercel-storage.com";

  // A minimal stub matching @vercel/blob's `put` signature used by the adapter.
  async function putStub(
    pathname: string,
    body: Uint8Array | Buffer,
    options: { access: string; addRandomSuffix: boolean; token?: string },
  ) {
    savedPuts.push({ pathname, body, options });
    return {
      url: `${fakeStoreUrl}/${pathname}`,
      pathname,
      contentType: "image/png",
      contentDisposition: "inline",
      downloadUrl: `${fakeStoreUrl}/${pathname}`,
    };
  }

  // --- save returns publicUrl from the Blob result ---
  const storage = new VercelBlobMediaStorage({
    put: putStub as never,
    token: "test-blob-token",
  });

  const bytes = new Uint8Array([1, 2, 3, 4]);
  const saved = await storage.save({ bytes, mimeType: "image/png" });

  assert.equal(saved.fileName.length > 0, true, "fileName generated");
  assert.ok(saved.fileName.endsWith(".png"), "fileName carries the png extension");
  assert.equal(
    saved.publicUrl,
    `${fakeStoreUrl}/${saved.fileName}`,
    "publicUrl mirrors the Blob result url",
  );
  assert.equal(savedPuts.length, 1);
  assert.equal(savedPuts[0].options.access, "public", "blob must be public-read");
  assert.equal(savedPuts[0].options.addRandomSuffix, false, "pathname is the fileName");
  assert.equal(savedPuts[0].options.token, "test-blob-token");
  assert.deepEqual(
    Array.from(Buffer.from(savedPuts[0].body)),
    Array.from(bytes),
    "uploaded bytes preserved",
  );
  assert.equal(savedPuts[0].pathname, saved.fileName);

  // --- unsupported MIME rejected before any put ---
  savedPuts.length = 0;
  await assert.rejects(
    () => storage.save({ bytes, mimeType: "text/csv" }),
    /Unsupported media type/,
  );
  assert.equal(savedPuts.length, 0, "no put call for unsupported mime");

  // --- load returns null (blob is addressed by publicUrl, not fileName) ---
  const loaded = await storage.load(saved.fileName);
  assert.equal(loaded, null);

  console.log("VercelBlobMediaStorage tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});