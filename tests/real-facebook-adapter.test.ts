import assert from "node:assert/strict";
import type { SocialAccount } from "@prisma/client";
import { encryptToken } from "../src/lib/tokens/crypto";
import {
  AnalyticsNotImplementedError,
  RealFacebookAdapter,
} from "../src/lib/platforms/adapters/realFacebook";
import type { PublishInput } from "../src/lib/platforms/types";

process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ??
  "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";

const PLAINTEXT_TOKEN = "EAABpage_token_abc123";
const PAGE_ID = "987654321";

function setActiveAccount(): SocialAccount {
  return {
    id: "account-1",
    userId: "user-1",
    platform: "FACEBOOK",
    handle: "Acme Page",
    accessToken: encryptToken(PLAINTEXT_TOKEN),
    refreshToken: null,
    expiresAt: null,
    scope: null,
    platformUserId: PAGE_ID,
    status: "ACTIVE",
  };
}

interface StubFetch {
  (input: URL | string, init?: RequestInit): Promise<Response>;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function installFetch(stub: StubFetch): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = stub as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = original;
  };
}

function input(overrides: Partial<PublishInput> = {}): PublishInput {
  return {
    targetId: "target-1",
    idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    text: "Hello from SocJam",
    media: [],
    account: setActiveAccount(),
    ...overrides,
  };
}

async function run(): Promise<void> {
  // Meta OAuth env must be set so RealFacebookAdapter's config load works.
  process.env.META_APP_ID = "test-app-id";
  process.env.META_APP_SECRET = "test-app-secret";
  process.env.META_REDIRECT_URI = "http://localhost:3000/api/oauth/meta/callback";
  process.env.META_GRAPH_API_VERSION = "v19.0";
  process.env.AUTH_SECRET = "test-auth-secret";

  // --- Successful publish ---
  let capturedUrl: URL | null = null;
  let capturedInit: RequestInit | null = null;
  const restore = installFetch(async (inputUrl, init) => {
    const u = new URL(String(inputUrl));
    capturedUrl = u;
    capturedInit = init ?? null;
    return jsonResponse(200, { id: `${PAGE_ID}_post_999` });
  });
  const adapter = new RealFacebookAdapter();
  const success = await adapter.publishPost(input());
  assert.equal(success.ok, true);
  if (success.ok) {
    assert.equal(
      success.publishedUrl,
      `https://www.facebook.com/${PAGE_ID}_post_999`,
    );
  }
  assert.ok(capturedUrl, "publish made an HTTP call");
  const url = capturedUrl as URL;
  const postBody = new URLSearchParams(
    String((capturedInit as RequestInit | null)?.body ?? ""),
  );
  assert.equal(url.pathname, `/v19.0/${PAGE_ID}/feed`);
  assert.equal(postBody.get("message"), "Hello from SocJam");
  assert.equal(postBody.get("access_token"), PLAINTEXT_TOKEN);
  assert.equal(url.search, "", "POST params must not appear in the URL query");
  assert.equal((capturedInit as RequestInit | null)?.method, "POST");
  restore();

  // --- Auth expired (401) ---
  const restore401 = installFetch(async () => {
    return jsonResponse(401, {
      error: { message: "Session has expired", type: "OAuthException", code: 190 },
    });
  });
  const adapter401 = new RealFacebookAdapter();
  const expired = await adapter401.publishPost(input());
  assert.equal(expired.ok, false);
  if (!expired.ok) {
    assert.equal(expired.authExpired, true, "authExpired flag should be set on 190 error");
    assert.equal(expired.retryable, false);
    assert.ok(expired.error.length > 0);
  }
  restore401();

  // --- checkAuth active (returns { active, account }) ---
  const restoreAuthOk = installFetch(async () =>
    jsonResponse(200, { name: "Acme Page" }),
  );
  const adapterAuthOk = new RealFacebookAdapter();
  const activeCheck = await adapterAuthOk.checkAuth(setActiveAccount());
  assert.equal(activeCheck.active, true);
  assert.ok(activeCheck.account, "refreshed account should be returned");
  restoreAuthOk();

  // --- checkAuth expired returns active=false ---
  const restoreAuthExpired = installFetch(async () =>
    jsonResponse(401, {
      error: { message: "bad token", code: 190 },
    }),
  );
  const adapterAuthExpired = new RealFacebookAdapter();
  const expiredCheck = await adapterAuthExpired.checkAuth(setActiveAccount());
  assert.equal(expiredCheck.active, false);
  restoreAuthExpired();

  // --- Rate limit (429) → retryable, not authExpired ---
  const restore429 = installFetch(async () =>
    jsonResponse(429, { error: { message: "rate limited", code: 4 } }),
  );
  const adapter429 = new RealFacebookAdapter();
  const rateLimited = await adapter429.publishPost(input());
  assert.equal(rateLimited.ok, false);
  if (!rateLimited.ok) {
    assert.equal(rateLimited.authExpired, false);
    assert.equal(rateLimited.retryable, true);
  }
  restore429();

  // --- Video-only media → explicit rejection, never a silent text-only post ---
  {
    let graphCalls = 0;
    const restoreVideo = installFetch(async () => {
      graphCalls += 1;
      return jsonResponse(200, { id: `${PAGE_ID}_post_video` });
    });
    const videoAdapter = new RealFacebookAdapter();
    const videoResult = await videoAdapter.publishPost(
      input({
        media: [
          {
            id: "video-1",
            postId: "post-1",
            url: "https://example.com/video.mp4",
            type: "VIDEO",
            mimeType: "video/mp4",
            sizeBytes: 1024 * 1024,
            width: null,
            height: null,
            order: 0,
          },
        ],
      }),
    );
    assert.equal(videoResult.ok, false, "video-only media must be rejected");
    if (!videoResult.ok) {
      assert.equal(videoResult.retryable, false);
      assert.ok(!videoResult.authExpired);
      assert.ok(videoResult.error.includes("images only"));
    }
    assert.equal(graphCalls, 0, "no Graph call should be made for rejected media");
    restoreVideo();
  }

  // --- Sanitization: provider error body never leaks ---
  const restoreLeak = installFetch(async () =>
    jsonResponse(400, {
      error: { message: "raw-internal-stack-detail-that-must-not-leak" },
    }),
  );
  const adapterLeak = new RealFacebookAdapter();
  const leaking = await adapterLeak.publishPost(input());
  assert.equal(leaking.ok, false);
  if (!leaking.ok) {
    assert.ok(!leaking.error.includes("raw-internal-stack-detail"));
    assert.ok(leaking.error.length > 0);
  }
  restoreLeak();

  // --- Network failure → retryable error, no exception ---
  const restoreNet = installFetch(async () => {
    throw new Error("fetch failed");
  });
  const adapterNet = new RealFacebookAdapter();
  const netFail = await adapterNet.publishPost(input());
  assert.equal(netFail.ok, false);
  if (!netFail.ok) {
    assert.equal(netFail.retryable, true);
  }
  restoreNet();

  // --- Single image: POST /photos with url + caption ---
  {
    let capturedUrl: URL | null = null;
    let capturedInit: RequestInit | null = null;
    const restorePhoto = installFetch(async (inputUrl, init) => {
      capturedUrl = new URL(String(inputUrl));
      capturedInit = init ?? null;
      const method = (init?.method ?? "GET").toUpperCase();
      assert.equal(method, "POST");
      return jsonResponse(200, { id: "photo_1", post_id: `${PAGE_ID}_photo_post` });
    });
    const adapterPhoto = new RealFacebookAdapter();
    const photoResult = await adapterPhoto.publishPost(input({
      media: [
        {
          id: "m1",
          postId: "post-1",
          url: "https://omnipost.public.blob.vercel-storage.com/p.png",
          type: "IMAGE",
          mimeType: "image/png",
          sizeBytes: 1024,
          width: null,
          height: null,
          order: 0,
        },
      ],
    }));
    assert.equal(photoResult.ok, true);
    if (photoResult.ok) {
      assert.equal(photoResult.publishedUrl, `https://www.facebook.com/${PAGE_ID}_photo_post`);
    }
    assert.ok(capturedUrl, "photos request made");
    const photoUrl = capturedUrl as URL;
    const photoBody = new URLSearchParams(
      String((capturedInit as RequestInit | null)?.body ?? ""),
    );
    assert.equal(photoUrl.pathname, `/v19.0/${PAGE_ID}/photos`);
    assert.equal(photoBody.get("url"), "https://omnipost.public.blob.vercel-storage.com/p.png");
    assert.equal(photoBody.get("caption"), "Hello from SocJam");
    assert.equal(photoBody.get("access_token"), PLAINTEXT_TOKEN);
    assert.equal(photoUrl.search, "", "POST params must not appear in the URL query");
    restorePhoto();
  }

  // --- Carousel: 3 unpublished /photos then /feed with attached_media ---
  {
    const childIds = ["fbid_1", "fbid_2", "fbid_3"];
    let photoCalled = 0;
    const feedCalls: Array<{ url: URL; body: URLSearchParams }> = [];
    const restoreCarousel = installFetch(async (inputUrl, init) => {
      const url = new URL(String(inputUrl));
      const method = (init?.method ?? "GET").toUpperCase();
      assert.equal(method, "POST");
      if (url.pathname.endsWith(`/${PAGE_ID}/photos`)) {
        const id = childIds[photoCalled++];
        return jsonResponse(200, { id });
      }
      if (url.pathname.endsWith(`/${PAGE_ID}/feed`)) {
        feedCalls.push({ url, body: new URLSearchParams(String(init?.body ?? "")) });
        return jsonResponse(200, { id: `${PAGE_ID}_carousel_post` });
      }
      return jsonResponse(500, {});
    });
    const adapterCarousel = new RealFacebookAdapter();
    const carouselResult = await adapterCarousel.publishPost(input({
      media: [
        { id: "m1", postId: "post-1", url: "https://x/a.png", type: "IMAGE", mimeType: "image/png", sizeBytes: 1, width: null, height: null, order: 0 },
        { id: "m2", postId: "post-1", url: "https://x/b.png", type: "IMAGE", mimeType: "image/png", sizeBytes: 1, width: null, height: null, order: 1 },
        { id: "m3", postId: "post-1", url: "https://x/c.png", type: "IMAGE", mimeType: "image/png", sizeBytes: 1, width: null, height: null, order: 2 },
      ],
    }));
    assert.equal(carouselResult.ok, true);
    if (carouselResult.ok) {
      assert.equal(carouselResult.publishedUrl, `https://www.facebook.com/${PAGE_ID}_carousel_post`);
    }
    assert.equal(photoCalled, 3, "one unpublished photo per carousel item");
    assert.equal(feedCalls.length, 1, "feed call with attached_media made");
    const { url: feed, body: feedParams } = feedCalls[0];
    assert.equal(feed.search, "", "POST params must not appear in the URL query");
    assert.equal(feedParams.get("message"), "Hello from SocJam");
    assert.equal(feedParams.get("attached_media[0]"), JSON.stringify({ media_fbid: "fbid_1" }));
    assert.equal(feedParams.get("attached_media[1]"), JSON.stringify({ media_fbid: "fbid_2" }));
    assert.equal(feedParams.get("attached_media[2]"), JSON.stringify({ media_fbid: "fbid_3" }));
    restoreCarousel();
  }

  // --- Analytics throws (deferred to a later phase) ---
  try {
    await adapter.fetchAnalytics({
      id: "target-1",
      postId: "post-1",
      accountId: "account-1",
      platform: "FACEBOOK",
      adaptedText: "hello",
      status: "PUBLISHED",
      scheduledAt: null,
      publishedAt: null,
      publishedUrl: null,
      error: null,
      attempts: 1,
    } as never);
    assert.fail("fetchAnalytics should throw");
  } catch (error) {
    assert.ok(error instanceof AnalyticsNotImplementedError);
  }

  console.log("RealFacebook adapter tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});