import assert from "node:assert/strict";
import type { Platform } from "../src/lib/platforms/constraints";
import { createRetryPublisher } from "../src/lib/posts/retry";

async function run(): Promise<void> {
  const calls: string[] = [];
  const post = {
    id: "post-1",
    userId: "user-1",
    idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    media: [],
    targets: [
      { id: "published", accountId: "account-x", platform: "X" as Platform, adaptedText: "kept", status: "PUBLISHED" as const, attempts: 1, account: { id: "account-x", userId: "user-1", platform: "X" as const, handle: "@x", accessToken: "token", status: "ACTIVE" as const } },
      { id: "failed", accountId: "account-linkedin", platform: "LINKEDIN" as Platform, adaptedText: "retry", status: "PUBLISHING" as const, attempts: 2, account: { id: "account-linkedin", userId: "user-1", platform: "LINKEDIN" as const, handle: "@linkedin", accessToken: "token", status: "ACTIVE" as const } },
    ],
  };

  const service = createRetryPublisher({
    claimFailedTargets: async () => post,
    findPost: async () => post,
    loadResult: async () => null,
    updatePostStatus: async (_id, status) => { calls.push(`status:${status}`); },
    markTargetPublished: async (id) => { calls.push(`published:${id}`); },
    markTargetFailed: async (id) => { calls.push(`failed:${id}`); },
    markAccountReconnectRequired: async (id) => { calls.push(`reconnect:${id}`); },
    getAdapter: () => ({
      platform: "LINKEDIN",
      getConstraints: () => ({ maxChars: 3000, maxImages: 9, requiresImage: false, requiresVideo: false, maxVideoSeconds: 0, maxFileSizeMB: 10, supportedMediaTypes: [] }),
      validatePost: () => ({ valid: true, errors: [] }),
      checkAuth: async () => ({ active: true }),
      publishPost: async (input) => { calls.push(`adapter:${input.targetId}`); return { ok: true, publishedUrl: "https://mock.local/retry" }; },
      fetchAnalytics: async () => ({ impressions: 1, likes: 1, comments: 1, shares: 1 }),
    }),
  });

  await service("post-1", "user-1");
  assert.deepEqual(calls.filter((call) => call.startsWith("adapter:")), ["adapter:failed"]);
  assert.equal(calls.includes("adapter:published"), false);

  let claimed = false;
  const concurrentCalls: string[] = [];
  const concurrentService = createRetryPublisher({
    claimFailedTargets: async () => {
      if (claimed) return null;
      claimed = true;
      return post;
    },
    findPost: async () => post,
    loadResult: async () => null,
    updatePostStatus: async () => undefined,
    markTargetPublished: async (id) => { concurrentCalls.push(`published:${id}`); },
    markTargetFailed: async (id) => { concurrentCalls.push(`failed:${id}`); },
    markAccountReconnectRequired: async () => undefined,
    getAdapter: () => ({
      platform: "LINKEDIN",
      getConstraints: () => ({ maxChars: 3000, maxImages: 9, requiresImage: false, requiresVideo: false, maxVideoSeconds: 0, maxFileSizeMB: 10, supportedMediaTypes: [] }),
      validatePost: () => ({ valid: true, errors: [] }),
      checkAuth: async () => ({ active: true }),
      publishPost: async (input) => { concurrentCalls.push(`adapter:${input.targetId}`); return { ok: true, publishedUrl: "https://mock.local/retry" }; },
      fetchAnalytics: async () => ({ impressions: 1, likes: 1, comments: 1, shares: 1 }),
    }),
  });
  await Promise.all([
    concurrentService("post-1", "user-1"),
    concurrentService("post-1", "user-1"),
  ]);
  assert.deepEqual(concurrentCalls.filter((call) => call.startsWith("adapter:")), ["adapter:failed"]);

  console.log("Retry tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
