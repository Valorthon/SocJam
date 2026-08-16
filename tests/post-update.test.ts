import assert from "node:assert/strict";
import type { SocialAccount } from "@prisma/client";
import {
  createUpdatePostRouteHandler,
  type UpdatePostRouteDependencies,
} from "../src/lib/posts/route-handlers";
import type { PostWithRelations } from "../src/lib/posts";

const userId = "user-1";

const account: SocialAccount = {
  id: "account-1",
  userId,
  platform: "X",
  handle: "@omnipost",
  accessToken: "mock-token",
  refreshToken: null,
  expiresAt: null,
  scope: null,
  platformUserId: null,
  status: "ACTIVE",
};

function postFixture(status: "DRAFT" | "SCHEDULED", scheduledAt: string | null): PostWithRelations {
  return {
    id: "ckwdna0nq0000a8test1234",
    userId,
    baseText: "Hello",
    status,
    scheduledAt,
    idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    media: [],
    targets: [{
      id: "target-1",
      postId: "post-1",
      accountId: account.id,
      platform: "X",
      adaptedText: "Hello",
      status,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      publishedAt: null,
      publishedUrl: null,
      error: null,
      attempts: 0,
      account,
    }],
  } as PostWithRelations;
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/posts/ckwdna0nq0000a8test1234", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function run(): Promise<void> {
  let post = postFixture("DRAFT", null);
  const dependencies: UpdatePostRouteDependencies = {
    getAuthenticatedUser: async () => ({ ok: true, userId }),
    findPostByIdAndUser: async () => post,
    getUserTimezone: async () => "UTC",
    schedulePost: async (_id, _userId, input) => {
      post = {
        ...post,
        status: "SCHEDULED",
        scheduledAt: input.scheduledAt,
        updatedAt: new Date(),
        targets: post.targets.map((target) => ({
          ...target,
          status: "SCHEDULED" as const,
          scheduledAt: input.scheduledAt,
        })),
      } as PostWithRelations;
      return post;
    },
    reschedulePost: async (_id, _userId, input) => {
      post = {
        ...post,
        scheduledAt: input.scheduledAt,
        updatedAt: new Date(),
        targets: post.targets.map((target) => ({
          ...target,
          scheduledAt: input.scheduledAt,
        })),
      } as PostWithRelations;
      return post;
    },
    cancelPost: async () => {
      post = {
        ...post,
        status: "FAILED",
        updatedAt: new Date(),
        targets: post.targets.map((target) => ({
          ...target,
          status: "CANCELLED" as const,
          error: "Cancelled by user.",
        })),
      } as PostWithRelations;
      return post;
    },
  };

  const handler = createUpdatePostRouteHandler(dependencies);

  const unauthenticated = createUpdatePostRouteHandler({
    ...dependencies,
    getAuthenticatedUser: async () => ({ ok: false as const }),
  });
  assert.equal((await unauthenticated(request({ action: "cancel", updatedAt: post.updatedAt.toISOString() }), { params: { id: "ckwdna0nq0000a8test1234" } })).status, 401);

  const malformed = await handler(request({ action: "cancel" }), { params: { id: "ckwdna0nq0000a8test1234" } });
  assert.equal(malformed.status, 400);

  const futureSlot = "2026-12-31T12:30:00.000Z";
  const scheduled = await handler(
    request({
      action: "schedule",
      scheduledAt: futureSlot,
      updatedAt: post.updatedAt.toISOString(),
    }),
    { params: { id: "ckwdna0nq0000a8test1234" } },
  );
  assert.equal(scheduled.status, 200);
  const scheduledBody = await scheduled.json();
  assert.equal(scheduledBody.post.status, "SCHEDULED");
  assert.equal(scheduledBody.post.targets[0].status, "SCHEDULED");

  const newSlot = "2026-12-31T15:00:00.000Z";
  const rescheduled = await handler(
    request({
      action: "reschedule",
      scheduledAt: newSlot,
      updatedAt: scheduledBody.post.updatedAt,
    }),
    { params: { id: "ckwdna0nq0000a8test1234" } },
  );
  assert.equal(rescheduled.status, 200);
  const rescheduledBody = await rescheduled.json();
  assert.equal(rescheduledBody.post.scheduledAt, newSlot);
  const cancelled = await handler(
    request({
      action: "cancel",
      updatedAt: rescheduledBody.post.updatedAt,
    }),
    { params: { id: "ckwdna0nq0000a8test1234" } },
  );
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).post.status, "FAILED");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
