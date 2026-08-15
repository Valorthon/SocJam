import assert from "node:assert/strict";
import type { SocialAccount } from "@prisma/client";
import { createPublishPostRouteHandler } from "../src/lib/posts/route-handlers";
import type { PostWithRelations } from "../src/lib/posts";
import { postDetailResponseSchema } from "../src/types";

const account: SocialAccount = {
  id: "account-1",
  userId: "user-1",
  platform: "X",
  handle: "@omnipost",
  accessToken: "token",
  refreshToken: null,
  expiresAt: null,
  scope: null,
  platformUserId: null,
  status: "ACTIVE",
};

function postFixture(status: "PUBLISHED" | "PARTIALLY_FAILED" = "PUBLISHED"): PostWithRelations {
  const postId = "clxxxxxxxxxxxxxxxxxxxxxxxx";
  return {
    id: postId, userId: "user-1", baseText: "Hello", status, scheduledAt: null,
    idempotencyKey: "123e4567-e89b-12d3-a456-426614174000", createdAt: new Date(), updatedAt: new Date(), media: [],
    targets: [{
      id: "target-1", postId, accountId: account.id, platform: "X", adaptedText: "Hello",
      status: status === "PUBLISHED" ? "PUBLISHED" : "FAILED", scheduledAt: null,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      publishedUrl: status === "PUBLISHED" ? "https://mock.x.local/post/target-1" : null,
      error: status === "PUBLISHED" ? null : "Unable to publish this target.", attempts: 1, account,
    }],
  };
}

async function run(): Promise<void> {
  let calls = 0;
  const handler = createPublishPostRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    publishPost: async () => { calls += 1; return postFixture(); },
  });

  const success = await handler(new Request("http://localhost"), { params: { id: "clxxxxxxxxxxxxxxxxxxxxxxxx" } });
  assert.equal(success.status, 200);
  assert.equal(postDetailResponseSchema.safeParse(await success.json()).success, true);
  assert.equal(calls, 1);

  // The HTTP handler forwards every request; publisher-level idempotency is covered in publisher.test.ts.
  const repeated = await handler(new Request("http://localhost"), { params: { id: "clxxxxxxxxxxxxxxxxxxxxxxxx" } });
  assert.equal(repeated.status, 200);
  assert.equal(calls, 2);

  const partial = createPublishPostRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    publishPost: async () => postFixture("PARTIALLY_FAILED"),
  });
  assert.equal((await partial(new Request("http://localhost"), { params: { id: "clxxxxxxxxxxxxxxxxxxxxxxxx" } })).status, 200);

  const missing = createPublishPostRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    publishPost: async () => null,
  });
  assert.equal((await missing(new Request("http://localhost"), { params: { id: "clxxxxxxxxxxxxxxxxxxxxxxxx" } })).status, 404);
  assert.equal((await missing(new Request("http://localhost"), { params: { id: "bad" } })).status, 400);

  const failing = createPublishPostRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    publishPost: async () => { throw new Error("provider details must not reach the client"); },
  });
  const originalConsoleError = console.error;
  console.error = () => undefined;
  let failure: Response;
  try {
    failure = await failing(new Request("http://localhost"), { params: { id: "clxxxxxxxxxxxxxxxxxxxxxxxx" } });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { error: "Unable to publish post." });

  const unauthorized = createPublishPostRouteHandler({
    getAuthenticatedUser: async () => ({ ok: false as const }),
    publishPost: async () => postFixture(),
  });
  assert.equal((await unauthorized(new Request("http://localhost"), { params: { id: "clxxxxxxxxxxxxxxxxxxxxxxxx" } })).status, 401);
  console.log("Publish API tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
