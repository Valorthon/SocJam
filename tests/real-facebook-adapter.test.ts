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
    text: "Hello from OmniPost",
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
  assert.equal(url.pathname, `/v19.0/${PAGE_ID}/feed`);
  assert.equal(url.searchParams.get("message"), "Hello from OmniPost");
  assert.equal(url.searchParams.get("access_token"), PLAINTEXT_TOKEN);
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