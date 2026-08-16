import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadMediaFromUrl } from "../src/lib/platforms/adapters/mediaLoader";

async function run(): Promise<void> {
  const uploadDir = path.join("/tmp/opencode", `media-loader-test-${Date.now()}`);
  await mkdir(uploadDir, { recursive: true });

  // --- Local upload URL reads from disk ---
  {
    const fileName = `${randomUUID()}.mp4`;
    const bytes = Buffer.from("local-video-bytes");
    await writeFile(path.join(uploadDir, fileName), bytes);
    const localUrl = `https://socjam.local/api/uploads/${fileName}`;

    const loaded = await loadMediaFromUrl(localUrl, { uploadDir });
    assert.ok(loaded, "local media should load");
    assert.equal(loaded!.mimeType, "video/mp4");
    assert.deepEqual(Buffer.from(loaded!.bytes), bytes);
  }

  // --- Local upload URL with missing file returns null ---
  {
    const localUrl = `https://socjam.local/api/uploads/${randomUUID()}.mp4`;
    const loaded = await loadMediaFromUrl(localUrl, { uploadDir });
    assert.equal(loaded, null);
  }

  // --- Public URL fetches bytes over HTTP, infers mime from extension ---
  {
    const publicUrl =
      "https://omnipost.public.blob.vercel-storage.com/uploaded-video.mp4";
    const payload = Buffer.from("public-video-bytes");
    const originalFetch = globalThis.fetch;
    let calledUrl = "";
    let calledMethod = "";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      calledUrl = request.url;
      calledMethod = request.method;
      return new Response(new Uint8Array(payload), {
        status: 200,
        headers: { "content-type": "video/mp4" },
      });
    }) as typeof globalThis.fetch;

    try {
      const loaded = await loadMediaFromUrl(publicUrl);
      assert.equal(calledUrl, publicUrl);
      assert.equal(calledMethod, "GET");
      assert.ok(loaded, "public media should load");
      assert.equal(loaded!.mimeType, "video/mp4");
      assert.deepEqual(Buffer.from(loaded!.bytes), payload);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // --- Public URL with missing content-type falls back to extension ---
  {
    const publicUrl =
      "https://omnipost.public.blob.vercel-storage.com/uploaded-video.webm";
    const payload = Buffer.from("webm-bytes");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(new Uint8Array(payload), {
        status: 200,
        // No content-type header — loader must infer video/webm from extension.
      })) as typeof globalThis.fetch;

    try {
      const loaded = await loadMediaFromUrl(publicUrl);
      assert.ok(loaded);
      assert.equal(loaded!.mimeType, "video/webm");
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // --- Non-2xx fetch returns null ---
  {
    const publicUrl =
      "https://omnipost.public.blob.vercel-storage.com/missing.mp4";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response("not found", { status: 404 })) as typeof globalThis.fetch;
    try {
      const loaded = await loadMediaFromUrl(publicUrl);
      assert.equal(loaded, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // --- Unsupported mime type returns null ---
  {
    const publicUrl =
      "https://omnipost.public.blob.vercel-storage.com/file.txt";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(new Uint8Array(Buffer.from("text")), {
        status: 200,
        headers: { "content-type": "text/plain" },
      })) as typeof globalThis.fetch;
    try {
      const loaded = await loadMediaFromUrl(publicUrl);
      assert.equal(loaded, null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  console.log("Media loader tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});