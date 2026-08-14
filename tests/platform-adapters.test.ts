import assert from "node:assert/strict";
import type { MediaAsset, PostTarget, SocialAccount } from "@prisma/client";
import { BaseMockAdapter, getMockFailureRate } from "../src/lib/platforms/adapters/baseMock";
import type { PublishInput } from "../src/lib/platforms/types";

const activeAccount: SocialAccount = {
  id: "account-1",
  userId: "user-1",
  platform: "X",
  handle: "@socjam",
  accessToken: "mock-token",
  refreshToken: null,
  expiresAt: null,
  scope: null,
  platformUserId: null,
  status: "ACTIVE",
  externalAccountId: null,
  refreshTokenEncrypted: null,
  tokenExpiresAt: null,
  metaUserId: null,
};

const publishedTarget: PostTarget = {
  id: "target-1",
  postId: "post-1",
  accountId: activeAccount.id,
  platform: "X",
  adaptedText: "Hello from SocJam",
  status: "PUBLISHED",
  scheduledAt: null,
  publishedAt: new Date("2026-01-01T00:00:00.000Z"),
  publishedUrl: "https://mock.x.local/post/target-1",
  error: null,
  attempts: 1,
};

function createInput(targetId: string, text = "Hello from SocJam"): PublishInput {
  return {
    targetId,
    idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    text,
    media: [],
    account: activeAccount,
  };
}

const image: MediaAsset = {
  id: "media-1",
  postId: "post-1",
  url: "https://socjam.local/api/uploads/image.jpg",
  type: "IMAGE",
  mimeType: "image/jpeg",
  sizeBytes: 1024,
  width: null,
  height: null,
  order: 0,
};

async function run(): Promise<void> {
  const originalFailureRate = process.env.MOCK_FAILURE_RATE;
  process.env.MOCK_FAILURE_RATE = "0";

  try {
    const xAdapter = new BaseMockAdapter("X");
    const input = createInput("target-1");
    const firstResult = await xAdapter.publishPost(input);
    const repeatedResult = await xAdapter.publishPost(input);

    assert.deepEqual(repeatedResult, firstResult);
    assert.deepEqual(await xAdapter.checkAuth(activeAccount), {
      active: true,
      account: activeAccount,
    });
    assert.equal(getMockFailureRate("1"), 1);
    assert.equal(getMockFailureRate("invalid"), 0);

    const instagramResult = await new BaseMockAdapter("INSTAGRAM").publishPost(
      createInput("target-2"),
    );
    assert.deepEqual(instagramResult, {
      ok: false,
      error: "Instagram requires an image",
      retryable: false,
    });

    const instagramWithImage = await new BaseMockAdapter("INSTAGRAM").publishPost({
      ...createInput("target-3"),
      media: [image],
    });
    assert.equal(instagramWithImage.ok, true);

    const firstAnalytics = await xAdapter.fetchAnalytics(publishedTarget);
    const repeatedAnalytics = await xAdapter.fetchAnalytics(publishedTarget);
    assert.deepEqual(repeatedAnalytics, firstAnalytics);
    assert.ok(firstAnalytics.impressions >= 100);
  } finally {
    if (originalFailureRate === undefined) {
      delete process.env.MOCK_FAILURE_RATE;
    } else {
      process.env.MOCK_FAILURE_RATE = originalFailureRate;
    }
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
