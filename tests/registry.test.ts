import assert from "node:assert/strict";
import { getPlatformAdapter } from "../src/lib/platforms/registry";
import { isFacebookRealEnabled, isInstagramRealEnabled } from "../src/lib/platforms/config";
import { mockInstagramAdapter } from "../src/lib/platforms/adapters/mockInstagram";
import { realInstagramAdapter } from "../src/lib/platforms/adapters/realInstagram";

async function run(): Promise<void> {
  const originalFb = process.env.FACEBOOK_ADAPTER;
  const originalIg = process.env.INSTAGRAM_ADAPTER;
  const originalMetaId = process.env.META_APP_ID;
  const originalMetaSecret = process.env.META_APP_SECRET;
  const originalMockPlatforms = process.env.MOCK_PLATFORMS;

  try {
    // Default state (no real flags): every platform uses a mock adapter.
    delete process.env.FACEBOOK_ADAPTER;
    delete process.env.INSTAGRAM_ADAPTER;
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    process.env.MOCK_PLATFORMS = "true";

    assert.equal(isFacebookRealEnabled(), false);
    assert.equal(isInstagramRealEnabled(), false);

    // Mock adapter contract still intact.
    const mockFb = getPlatformAdapter("FACEBOOK");
    assert.equal(mockFb.platform, "FACEBOOK");
    const result = await mockFb.publishPost({
      targetId: "registry-target-1",
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      text: "Hello",
      media: [],
      account: {
        id: "account-r",
        userId: "user-r",
        platform: "FACEBOOK",
        handle: "@mock",
        accessToken: "mock-token",
        refreshToken: null,
        expiresAt: null,
        scope: null,
        platformUserId: null,
        status: "ACTIVE",
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.publishedUrl.startsWith("https://mock.facebook.local/post/"));
    }

    // Flipping FACEBOOK_ADAPTER=real routes FB to a real adapter.
    process.env.FACEBOOK_ADAPTER = "real";
    const realFb = getPlatformAdapter("FACEBOOK");
    assert.equal(realFb.platform, "FACEBOOK");
    assert.notEqual(realFb, mockFb, "real adapter must not be the mock instance");
    assert.equal(isFacebookRealEnabled(), true);

    // Other platforms stay mock.
    delete process.env.FACEBOOK_ADAPTER;
    process.env.MOCK_PLATFORMS = "true";
    assert.equal(isFacebookRealEnabled(), false);

    // Auto-detect: META_APP_ID + META_APP_SECRET set → real.
    process.env.META_APP_ID = "123456789";
    process.env.META_APP_SECRET = "secret";
    assert.equal(isFacebookRealEnabled(), true);
    assert.equal(isInstagramRealEnabled(), true);

    // Explicit "mock" overrides auto-detect.
    process.env.FACEBOOK_ADAPTER = "mock";
    assert.equal(isFacebookRealEnabled(), false);
    delete process.env.FACEBOOK_ADAPTER;
    assert.equal(isFacebookRealEnabled(), true);

    // IG now routes to the real adapter when INSTAGRAM_ADAPTER=real (the
    // publish path is exercised fully in realInstagramAdapter.test.ts; here
    // we assert the registry branch picks the real instance over the mock).
    process.env.MOCK_PLATFORMS = "true";
    process.env.INSTAGRAM_ADAPTER = "mock";
    const igMock = getPlatformAdapter("INSTAGRAM");
    assert.equal(igMock, mockInstagramAdapter, "mock flag → mock IG instance");

    process.env.INSTAGRAM_ADAPTER = "real";
    assert.equal(isInstagramRealEnabled(), true);
    const igReal = getPlatformAdapter("INSTAGRAM");
    assert.equal(igReal, realInstagramAdapter, "real flag → real IG instance");
    assert.notEqual(igReal, igMock, "real adapter must not be the mock instance");

    console.log("Registry tests passed.");
  } finally {
    if (originalFb === undefined) {
      delete process.env.FACEBOOK_ADAPTER;
    } else {
      process.env.FACEBOOK_ADAPTER = originalFb;
    }
    if (originalIg === undefined) {
      delete process.env.INSTAGRAM_ADAPTER;
    } else {
      process.env.INSTAGRAM_ADAPTER = originalIg;
    }
    if (originalMetaId === undefined) {
      delete process.env.META_APP_ID;
    } else {
      process.env.META_APP_ID = originalMetaId;
    }
    if (originalMetaSecret === undefined) {
      delete process.env.META_APP_SECRET;
    } else {
      process.env.META_APP_SECRET = originalMetaSecret;
    }
    if (originalMockPlatforms === undefined) {
      delete process.env.MOCK_PLATFORMS;
    } else {
      process.env.MOCK_PLATFORMS = originalMockPlatforms;
    }
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});