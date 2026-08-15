import assert from "node:assert/strict";
import type { SocialAccount } from "@prisma/client";
import { createRetryPostRouteHandler } from "../src/lib/posts/route-handlers";
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

function postFixture(): PostWithRelations {
  const postId = "clxxxxxxxxxxxxxxxxxxxxxxxx";
  return {
    id: postId, userId: "user-1", baseText: "Hello", status: "PUBLISHED", scheduledAt: null,
    idempotencyKey: "123e4567-e89b-12d3-a456-426614174000", createdAt: new Date(), updatedAt: new Date(), media: [],
    targets: [{
      id: "target-1", postId, accountId: account.id, platform: "X", adaptedText: "Hello", status: "PUBLISHED",
      scheduledAt: null, publishedAt: new Date(), publishedUrl: "https://mock.x.local/post/target-1",
      error: null, attempts: 2, account,
    }],
  };
}

async function run(): Promise<void> {
  let calls = 0;
  const handler = createRetryPostRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    retryPost: async () => { calls += 1; return postFixture(); },
  });

  const success = await handler(new Request("http://localhost"), { params: { id: "clxxxxxxxxxxxxxxxxxxxxxxxx" } });
  assert.equal(success.status, 200);
  assert.equal(postDetailResponseSchema.safeParse(await success.json()).success, true);
  assert.equal(calls, 1);

  const missing = createRetryPostRouteHandler({
    getAuthenticatedUser: async () => ({ ok: true, userId: "user-1" }),
    retryPost: async () => null,
  });
  assert.equal((await missing(new Request("http://localhost"), { params: { id: "clxxxxxxxxxxxxxxxxxxxxxxxx" } })).status, 404);
  assert.equal((await missing(new Request("http://localhost"), { params: { id: "bad" } })).status, 400);

  const unauthorized = createRetryPostRouteHandler({
    getAuthenticatedUser: async () => ({ ok: false as const }),
    retryPost: async () => postFixture(),
  });
  assert.equal((await unauthorized(new Request("http://localhost"), { params: { id: "clxxxxxxxxxxxxxxxxxxxxxxxx" } })).status, 401);
  console.log("Retry API tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
