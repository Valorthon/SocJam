import assert from "node:assert/strict";
import type { MediaAsset, PostStatus, SocialAccount, TargetStatus } from "@prisma/client";
import { createPublisher } from "@/lib/posts/publisher";
import { derivePostStatus } from "@/lib/posts/status";
import type { PostWithRelations } from "@/lib/posts";
import type { Platform } from "@/lib/platforms/constraints";
import type { PublishInput, SocialPlatformAdapter } from "@/lib/platforms/types";

type Target = {
  id: string;
  accountId: string;
  platform: Platform;
  adaptedText: string;
  status: TargetStatus;
  attempts: number;
  account: SocialAccount;
};

function account(id: string, platform: Platform): SocialAccount {
  return { id, userId: "user-1", platform, handle: `@${id}`, accessToken: "token", status: "ACTIVE" };
}

function fixture(): { post: { id: string; userId: string; idempotencyKey: string; status: PostStatus; targets: Target[]; media: MediaAsset[] }; result: PostWithRelations } {
  const targets: Target[] = [
    { id: "target-x", accountId: "account-x", platform: "X", adaptedText: "hello", status: "DRAFT", attempts: 0, account: account("account-x", "X") },
    { id: "target-linkedin", accountId: "account-linkedin", platform: "LINKEDIN", adaptedText: "hello", status: "DRAFT", attempts: 0, account: account("account-linkedin", "LINKEDIN") },
  ];
  const post = { id: "post-1", userId: "user-1", idempotencyKey: "key-1", status: "DRAFT" as PostStatus, targets, media: [] };
  return { post, result: post as unknown as PostWithRelations };
}

function adapter(
  platform: Platform,
  publish: SocialPlatformAdapter["publishPost"],
  active = true,
): SocialPlatformAdapter {
  return {
    platform,
    getConstraints: () => ({ maxChars: 280, maxImages: 4, requiresImage: false, requiresVideo: false, maxVideoSeconds: 0, maxFileSizeMB: 10, supportedMediaTypes: [] }),
    validatePost: (_input: PublishInput) => ({ valid: true, errors: [] }),
    publishPost: publish,
    checkAuth: async () => ({ active }),
    fetchAnalytics: async () => ({ impressions: 0, likes: 0, comments: 0, shares: 0 }),
  };
}

function adaptersFor(
  x: SocialPlatformAdapter,
  linkedIn: SocialPlatformAdapter,
): Record<Platform, SocialPlatformAdapter> {
  return { X: x, FACEBOOK: x, INSTAGRAM: x, TIKTOK: x, LINKEDIN: linkedIn };
}

function service(fixturePost: ReturnType<typeof fixture>["post"], adapters: Record<Platform, SocialPlatformAdapter>) {
  const statuses: PostStatus[] = [];
  const calls: string[] = [];
  const errors = new Map<string, string>();
  const dependencies = {
    claimPost: async () => {
      if (fixturePost.status !== "DRAFT") return null;
      fixturePost.status = "PUBLISHING";
      return fixturePost;
    },
    findPost: async () => fixturePost,
    loadResult: async () => fixturePost as unknown as PostWithRelations,
    updatePostStatus: async (_id: string, status: PostStatus) => { statuses.push(status); fixturePost.status = status; },
    markTargetPublishing: async (id: string) => {
      calls.push(`publishing:${id}`);
      const target = fixturePost.targets.find((item) => item.id === id)!;
      target.status = "PUBLISHING";
      target.attempts += 1;
    },
    markTargetPublished: async (id: string) => { calls.push(`published:${id}`); fixturePost.targets.find((target) => target.id === id)!.status = "PUBLISHED"; },
    markTargetFailed: async (id: string, error: string) => {
      calls.push(`failed:${id}`);
      errors.set(id, error);
      fixturePost.targets.find((target) => target.id === id)!.status = "FAILED";
    },
    markAccountReconnectRequired: async (accountId: string) => {
      fixturePost.targets.find((target) => target.accountId === accountId)!.account.status = "RECONNECT_REQUIRED";
    },
    getAdapter: (platform: Platform) => adapters[platform],
  };
  return { publish: createPublisher(dependencies), statuses, calls, errors };
}

async function run(): Promise<void> {
  assert.equal(derivePostStatus([{ status: "PUBLISHED" }, { status: "FAILED" }]), "PARTIALLY_FAILED");
  assert.equal(derivePostStatus([{ status: "FAILED" }, { status: "FAILED" }]), "FAILED");
  assert.equal(derivePostStatus([{ status: "PUBLISHED" }, { status: "FAILED" }, { status: "DRAFT" }]), "DRAFT");
  assert.equal(derivePostStatus([{ status: "SCHEDULED" }]), "SCHEDULED");
  assert.equal(derivePostStatus([{ status: "CANCELLED" }, { status: "MISSED" }]), "FAILED");
  assert.equal(derivePostStatus([{ status: "PUBLISHED" }, { status: "MISSED" }]), "PARTIALLY_FAILED");

  const success = fixture();
  const successful = adapter("X", async () => ({ ok: true, publishedUrl: "https://mock.local/x" }));
  const successfulLinkedIn = adapter("LINKEDIN", async () => ({ ok: true, publishedUrl: "https://mock.local/linkedin" }));
  const first = service(success.post, adaptersFor(successful, successfulLinkedIn));
  await first.publish("post-1", "user-1");
  assert.deepEqual(first.calls.filter((call) => call.startsWith("published:")), ["published:target-x", "published:target-linkedin"]);
  assert.equal(first.statuses.at(-1), "PUBLISHED");
  assert.deepEqual(success.post.targets.map((target) => target.attempts), [1, 1]);

  const successfulCalls = first.calls.length;
  await first.publish("post-1", "user-1");
  assert.equal(first.calls.length, successfulCalls);

  const partial = fixture();
  const failing = adapter("LINKEDIN", async () => ({ ok: false, error: "provider rejected", retryable: false }));
  const second = service(partial.post, adaptersFor(successful, failing));
  await second.publish("post-1", "user-1");
  assert.equal(second.statuses.at(-1), "PARTIALLY_FAILED");
  assert.equal(partial.post.targets[1].attempts, 1);

  const allFailed = fixture();
  const failedX = adapter("X", async () => ({ ok: false, error: "provider rejected", retryable: false }));
  const failedLinkedIn = adapter("LINKEDIN", async () => ({ ok: false, error: "provider rejected", retryable: false }));
  const third = service(allFailed.post, adaptersFor(failedX, failedLinkedIn));
  await third.publish("post-1", "user-1");
  assert.equal(third.statuses.at(-1), "FAILED");
  assert.deepEqual(allFailed.post.targets.map((target) => target.attempts), [1, 1]);

  const inactive = fixture();
  const inactiveX = adapter("X", async () => ({ ok: true, publishedUrl: "https://mock.local/x" }), false);
  const fourth = service(inactive.post, adaptersFor(inactiveX, successfulLinkedIn));
  await fourth.publish("post-1", "user-1");
  assert.equal(inactive.post.targets[0].status, "FAILED");
  assert.equal(inactive.post.targets[0].account.status, "RECONNECT_REQUIRED");
  assert.equal(fourth.errors.get("target-x"), "Reconnect your X account to publish this target.");

  const expired = fixture();
  const expiredX = adapter("X", async () => ({ ok: false, error: "token expired", authExpired: true, retryable: false }));
  const expiredPublisher = service(expired.post, adaptersFor(expiredX, successfulLinkedIn));
  await expiredPublisher.publish("post-1", "user-1");
  assert.equal(expiredPublisher.errors.get("target-x"), "Reconnect your X account to publish this target.");
  assert.equal(expired.post.targets[0].account.status, "RECONNECT_REQUIRED");

  const throwing = fixture();
  const throwingX = adapter("X", async () => { throw new Error("provider token and stack detail"); });
  const fifth = service(throwing.post, adaptersFor(throwingX, successfulLinkedIn));
  const loggedErrors: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => { loggedErrors.push(args); };
  try {
    await fifth.publish("post-1", "user-1");
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(fifth.errors.get("target-x"), "Unable to publish this target.");
  assert.equal(loggedErrors[0]?.[0], "Unable to publish target.");
  const loggedContext = loggedErrors[0]?.[1] as { postId: string; targetId: string };
  assert.equal(loggedContext.postId, "post-1");
  assert.equal(loggedContext.targetId, "target-x");

  const concurrent = fixture();
  let publishCalls = 0;
  const concurrentX = adapter("X", async () => { publishCalls += 1; return { ok: true, publishedUrl: "https://mock.local/x" }; });
  const concurrentLinkedIn = adapter("LINKEDIN", async () => { publishCalls += 1; return { ok: true, publishedUrl: "https://mock.local/linkedin" }; });
  const sixth = service(concurrent.post, adaptersFor(concurrentX, concurrentLinkedIn));
  await Promise.all([sixth.publish("post-1", "user-1"), sixth.publish("post-1", "user-1")]);
  assert.equal(publishCalls, 2);
  console.log("Publisher tests passed.");
}

void run();
