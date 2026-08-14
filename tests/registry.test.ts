import assert from "node:assert/strict";
import {
  __resetRealAdapterCacheForTests,
  connectModeFor,
  getPlatformAdapter,
  isRealPlatform,
} from "../src/lib/platforms/registry";

async function run(): Promise<void> {
  const originalFb = process.env.REAL_FACEBOOK;
  const originalIg = process.env.REAL_INSTAGRAM;

  try {
    // Default state (no real flags): every platform uses a mock adapter.
    delete process.env.REAL_FACEBOOK;
    delete process.env.REAL_INSTAGRAM;

    assert.equal(isRealPlatform("FACEBOOK"), false);
    assert.equal(isRealPlatform("INSTAGRAM"), false);
    assert.equal(isRealPlatform("X"), false);
    assert.equal(connectModeFor("FACEBOOK"), "mock");
    assert.equal(connectModeFor("INSTAGRAM"), "mock");

    // Mock adapter contract still intact.
    const mockFb = getPlatformAdapter("FACEBOOK");
    assert.equal(mockFb.platform, "FACEBOOK");
    // Mock adapter publishes a mock-url:
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
        status: "ACTIVE",
        externalAccountId: null,
        refreshTokenEncrypted: null,
        tokenExpiresAt: null,
        metaUserId: null,
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.publishedUrl.startsWith("https://mock.facebook.local/post/"));
    }

    // Flipping REAL_FACEBOOK=true routes FB to a real adapter.
    process.env.REAL_FACEBOOK = "true";
    __resetRealAdapterCacheForTests();
    const realFb = getPlatformAdapter("FACEBOOK");
    assert.equal(realFb.platform, "FACEBOOK");
    assert.notEqual(realFb, mockFb, "real adapter must not be the mock instance");

    // connectModeFor reflects the flag.
    assert.equal(connectModeFor("FACEBOOK"), "real");
    assert.equal(isRealPlatform("FACEBOOK"), true);

    // Other platforms stay mock.
    assert.equal(connectModeFor("X"), "mock");
    assert.equal(connectModeFor("LINKEDIN"), "mock");
    assert.equal(isRealPlatform("TIKTOK"), false);

    // IG special-case: IG advertise-real requires REAL_FACEBOOK too (since
    // IG publish path stays mock in this phase even when real OAuth is on).
    process.env.REAL_INSTAGRAM = "true";
    delete process.env.REAL_FACEBOOK;
    // IG alone → still reported as mock (FB flag missing).
    assert.equal(isRealPlatform("INSTAGRAM"), false);
    assert.equal(connectModeFor("INSTAGRAM"), "mock");
    // IG adapter still returns the mock even when both flags are on.
    process.env.REAL_FACEBOOK = "true";
    assert.equal(isRealPlatform("INSTAGRAM"), true);
    assert.equal(connectModeFor("INSTAGRAM"), "real");
    // And getPlatformAdapter still returns the mock for IG publish.
    const igAdapter = getPlatformAdapter("INSTAGRAM");
    const igResult = await igAdapter.publishPost({
      targetId: "ig-registry-target",
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      text: "hello",
      media: [
        {
          id: "img-1",
          postId: "post-1",
          url: "https://local/img.jpg",
          type: "IMAGE",
          sizeBytes: 1024,
          width: null,
          height: null,
          order: 0,
        },
      ],
      account: {
        id: "account-ig",
        userId: "user-ig",
        platform: "INSTAGRAM",
        handle: "@mock",
        accessToken: "mock-token",
        status: "ACTIVE",
        externalAccountId: null,
        refreshTokenEncrypted: null,
        tokenExpiresAt: null,
        metaUserId: null,
      },
    });
    assert.equal(igResult.ok, true);
    if (igResult.ok) {
      assert.ok(igResult.publishedUrl.startsWith("https://mock.instagram.local/post/"));
    }

    console.log("Registry tests passed.");
  } finally {
    if (originalFb === undefined) {
      delete process.env.REAL_FACEBOOK;
    } else {
      process.env.REAL_FACEBOOK = originalFb;
    }
    if (originalIg === undefined) {
      delete process.env.REAL_INSTAGRAM;
    } else {
      process.env.REAL_INSTAGRAM = originalIg;
    }
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});