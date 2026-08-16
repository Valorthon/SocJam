import assert from "node:assert/strict";
import type { MediaAsset, SocialAccount } from "@prisma/client";
import { encryptToken } from "../src/lib/tokens/crypto";
import {
  AnalyticsNotImplementedError,
} from "../src/lib/platforms/adapters/realFacebook";
import {
  RealInstagramAdapter,
} from "../src/lib/platforms/adapters/realInstagram";
import type { PublishInput } from "../src/lib/platforms/types";

process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ??
  "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";

const PLAINTEXT_TOKEN = "IGABpage_token_xyz789";
const IG_BUS_ID = "17841400012345678";
const PUBLIC_IMAGE_URL = "https://omnipost.public.blob.vercel-storage.com/abc.png";

function setActiveAccount(): SocialAccount {
  return {
    id: "account-ig-1",
    userId: "user-1",
    platform: "INSTAGRAM",
    handle: "@omnipost",
    accessToken: encryptToken(PLAINTEXT_TOKEN),
    refreshToken: null,
    expiresAt: null,
    scope: null,
    platformUserId: IG_BUS_ID,
    status: "ACTIVE",
  };
}

function imageAsset(order: number): MediaAsset {
  return {
    id: `img-${order}`,
    postId: "post-1",
    url: `${PUBLIC_IMAGE_URL}?n=${order}`,
    type: "IMAGE",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    width: null,
    height: null,
    order,
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
    targetId: "ig-target-1",
    idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    text: "Sunset from the rooftop",
    media: [imageAsset(0)],
    account: setActiveAccount(),
    ...overrides,
  };
}

interface Dispatch {
  (url: URL, method: string): Response | Promise<Response>;
}

function installDispatch(dispatch: Dispatch): {
  restore: () => void;
  calls: Array<{ url: URL; method: string }>;
} {
  const calls: Array<{ url: URL; method: string }> = [];
  const restore = installFetch(async (inputUrl, init) => {
    const url = new URL(String(inputUrl));
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method });
    return dispatch(url, method);
  });
  return { restore, calls };
}

async function run(): Promise<void> {
  // Meta OAuth env must be set so the adapter's config load works.
  process.env.META_APP_ID = "test-app-id";
  process.env.META_APP_SECRET = "test-app-secret";
  process.env.META_REDIRECT_URI = "http://localhost:3000/api/oauth/meta/callback";
  process.env.META_GRAPH_API_VERSION = "v19.0";
  process.env.AUTH_SECRET = "test-auth-secret";

  // --- Single image happy path ---
  {
    const { restore, calls } = installDispatch((url, method) => {
      const pathname = url.pathname;
      if (method === "POST" && pathname.endsWith(`/${IG_BUS_ID}/media`)) {
        return jsonResponse(200, { id: "container_1789001" });
      }
      if (method === "GET" && pathname.endsWith("/container_1789001")) {
        return jsonResponse(200, { status_code: "FINISHED" });
      }
      if (method === "POST" && pathname.endsWith(`/${IG_BUS_ID}/media_publish`)) {
        return jsonResponse(200, { id: "1790000001" });
      }
      if (method === "GET" && pathname.endsWith("/1790000001")) {
        return jsonResponse(200, { permalink: "https://www.instagram.com/p/Cabc123/" });
      }
      return jsonResponse(500, {});
    });
    const adapter = new RealInstagramAdapter({
      pollIntervalMs: 0,
      pollMaxAttempts: 5,
      sleep: async () => undefined,
    });
    const result = await adapter.publishPost(input());
    assert.equal(result.ok, true, "single-image publish should succeed");
    if (result.ok) {
      assert.equal(result.publishedUrl, "https://www.instagram.com/p/Cabc123/");
    }
    // Container created, polled once, published, permalink fetched.
    const [createCall, pollCall, publishCall, permalinkCall] = calls;
    assert.ok(createCall, "container create call made");
    assert.equal(createCall.method, "POST");
    assert.equal(createCall.url.searchParams.get("image_url"), `${PUBLIC_IMAGE_URL}?n=0`);
    assert.equal(createCall.url.searchParams.get("caption"), "Sunset from the rooftop");
    assert.equal(createCall.url.searchParams.get("access_token"), PLAINTEXT_TOKEN);
    assert.equal(pollCall.method, "GET");
    assert.equal(pollCall.url.searchParams.get("fields"), "status_code");
    assert.equal(publishCall.method, "POST");
    assert.equal(publishCall.url.searchParams.get("creation_id"), "container_1789001");
    assert.equal(permalinkCall.url.searchParams.get("fields"), "permalink");
    restore();
  }

  // --- Carousel happy path (3 images) ---
  {
    const childIds = ["child_1", "child_2", "child_3"];
    let childCalled = 0;
    let polledChild = 0;
    const { restore, calls } = installDispatch((url, method) => {
      const pathname = url.pathname;
      if (method === "POST" && pathname.endsWith(`/${IG_BUS_ID}/media`)) {
        const mediaType = url.searchParams.get("media_type");
        if (mediaType === "CAROUSEL") {
          return jsonResponse(200, { id: "parent_container_99" });
        }
        // carousel item
        const id = childIds[childCalled++] ?? "child_x";
        return jsonResponse(200, { id });
      }
      if (method === "GET" && pathname.endsWith("/parent_container_99")) {
        polledChild++;
        return jsonResponse(200, { status_code: "FINISHED" });
      }
      if (method === "POST" && pathname.endsWith(`/${IG_BUS_ID}/media_publish`)) {
        return jsonResponse(200, { id: "carousel_media_1" });
      }
      if (method === "GET" && pathname.endsWith("/carousel_media_1")) {
        return jsonResponse(200, { permalink: "https://www.instagram.com/p/Ccarousel/" });
      }
      return jsonResponse(500, {});
    });
    const adapter = new RealInstagramAdapter({
      pollIntervalMs: 0,
      pollMaxAttempts: 5,
      sleep: async () => undefined,
    });
    const result = await adapter.publishPost(
      input({ media: [imageAsset(0), imageAsset(1), imageAsset(2)] }),
    );
    assert.equal(result.ok, true, "carousel publish should succeed");
    if (result.ok) {
      assert.equal(result.publishedUrl, "https://www.instagram.com/p/Ccarousel/");
    }
    // 3 carousel item calls + 1 parent call.
    const mediaPosts = calls.filter(
      (c) => c.method === "POST" && c.url.pathname.endsWith(`/${IG_BUS_ID}/media`),
    );
    assert.equal(mediaPosts.length, 4, "3 items + 1 parent container");
    const parentCall = mediaPosts.find((c) =>
      c.url.searchParams.get("media_type") === "CAROUSEL",
    );
    assert.ok(parentCall, "parent CAROUSEL container created");
    assert.equal(
      parentCall.url.searchParams.get("children"),
      "child_1,child_2,child_3",
    );
    // Each item call set is_carousel_item=true.
    const itemCalls = mediaPosts.filter(
      (c) => c.url.searchParams.get("is_carousel_item") === "true",
    );
    assert.equal(itemCalls.length, 3);
    assert.equal(polledChild, 1, "polled the parent container once (FINISHED)");
    restore();
  }

  // --- Validation: no image → retryable false ---
  {
    const { restore } = installDispatch(() => jsonResponse(200, {}));
    const adapter = new RealInstagramAdapter({
      pollIntervalMs: 0,
      pollMaxAttempts: 5,
      sleep: async () => undefined,
    });
    const result = await adapter.publishPost(input({ media: [] }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.retryable, false);
      assert.ok(result.error.includes("Instagram requires an image"));
    }
    restore();
  }

  // --- Container ERROR status → retryable true ---
  {
    const { restore } = installDispatch((url, method) => {
      const pathname = url.pathname;
      if (method === "POST" && pathname.endsWith(`/${IG_BUS_ID}/media`)) {
        return jsonResponse(200, { id: "bad_container" });
      }
      if (method === "GET" && pathname.endsWith("/bad_container")) {
        return jsonResponse(200, { status_code: "ERROR" });
      }
      return jsonResponse(500, {});
    });
    const adapter = new RealInstagramAdapter({
      pollIntervalMs: 0,
      pollMaxAttempts: 5,
      sleep: async () => undefined,
    });
    const result = await adapter.publishPost(input());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.retryable, true);
      assert.ok(result.error.length > 0);
    }
    restore();
  }

  // --- Container TIMEOUT → retryable true ---
  {
    const { restore } = installDispatch((url, method) => {
      const pathname = url.pathname;
      if (method === "POST" && pathname.endsWith(`/${IG_BUS_ID}/media`)) {
        return jsonResponse(200, { id: "slow_container" });
      }
      if (method === "GET" && pathname.endsWith("/slow_container")) {
        return jsonResponse(200, { status_code: "IN_PROGRESS" });
      }
      return jsonResponse(500, {});
    });
    const adapter = new RealInstagramAdapter({
      pollIntervalMs: 0,
      pollMaxAttempts: 3,
      sleep: async () => undefined,
    });
    const result = await adapter.publishPost(input());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.retryable, true);
      assert.ok(result.error.includes("still processing"));
    }
    restore();
  }

  // --- Auth expired (401 code 190) on /media → authExpired true ---
  {
    const { restore } = installDispatch((url, method) => {
      if (method === "POST" && url.pathname.endsWith(`/${IG_BUS_ID}/media`)) {
        return jsonResponse(401, {
          error: { message: "Session expired", type: "OAuthException", code: 190 },
        });
      }
      return jsonResponse(500, {});
    });
    const adapter = new RealInstagramAdapter({
      pollIntervalMs: 0,
      pollMaxAttempts: 5,
      sleep: async () => undefined,
    });
    const result = await adapter.publishPost(input());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.authExpired, true);
      assert.equal(result.retryable, false);
      assert.ok(result.error.includes("Reconnect"));
    }
    restore();
  }

  // --- Network failure on /media → retryable true ---
  {
    const { restore } = installDispatch(() => {
      throw new Error("fetch failed");
    });
    const adapter = new RealInstagramAdapter({
      pollIntervalMs: 0,
      pollMaxAttempts: 5,
      sleep: async () => undefined,
    });
    const result = await adapter.publishPost(input());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.retryable, true);
      assert.ok(result.error.includes("Unable to reach Instagram"));
    }
    restore();
  }

  // --- Sanitization: provider error body never leaks ---
  {
    const { restore } = installDispatch((url, method) => {
      if (method === "POST" && url.pathname.endsWith(`/${IG_BUS_ID}/media`)) {
        return jsonResponse(400, {
          error: { message: "raw-internal-stack-detail-that-must-not-leak" },
        });
      }
      return jsonResponse(500, {});
    });
    const adapter = new RealInstagramAdapter({
      pollIntervalMs: 0,
      pollMaxAttempts: 5,
      sleep: async () => undefined,
    });
    const result = await adapter.publishPost(input());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(!result.error.includes("raw-internal-stack-detail"));
      assert.ok(result.error.length > 0);
    }
    restore();
  }

  // --- Missing platformUserId → authExpired (account incomplete) ---
  {
    const { restore } = installDispatch(() => jsonResponse(200, {}));
    const adapter = new RealInstagramAdapter({
      pollIntervalMs: 0,
      pollMaxAttempts: 5,
      sleep: async () => undefined,
    });
    const incompleteAccount = setActiveAccount();
    incompleteAccount.platformUserId = null;
    const result = await adapter.publishPost(input({ account: incompleteAccount }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.authExpired, true);
      assert.equal(result.retryable, false);
    }
    restore();
  }

  // --- checkAuth active ---
  {
    const { restore } = installDispatch((url) => {
      if (url.pathname.endsWith(`/${IG_BUS_ID}`)) {
        return jsonResponse(200, { username: "omnipost" });
      }
      return jsonResponse(500, {});
    });
    const adapter = new RealInstagramAdapter();
    const check = await adapter.checkAuth(setActiveAccount());
    assert.equal(check.active, true);
    assert.ok(check.account, "refreshed account returned");
    restore();
  }

  // --- checkAuth expired ---
  {
    const { restore } = installDispatch(() =>
      jsonResponse(401, { error: { message: "bad token", code: 190 } }),
    );
    const adapter = new RealInstagramAdapter();
    const check = await adapter.checkAuth(setActiveAccount());
    assert.equal(check.active, false);
    restore();
  }

  // --- Analytics throws (deferred phase) ---
  {
    const adapter = new RealInstagramAdapter();
    try {
      await adapter.fetchAnalytics({
        id: "t-1",
        postId: "p-1",
        accountId: "a-1",
        platform: "INSTAGRAM",
        adaptedText: "hi",
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
      assert.ok(error instanceof Error);
    }
  }

  console.log("RealInstagram adapter tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});