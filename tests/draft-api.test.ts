import assert from "node:assert/strict";
import type { SocialAccount } from "@prisma/client";

import {
  createDraftRouteHandler,
  type DraftRouteDependencies,
} from "../src/lib/posts/draft-route-handlers";
import type { PostWithRelations } from "../src/lib/posts";

const userId = "user-1";
const key = "123e4567-e89b-12d3-a456-426614174010";
const account: SocialAccount = {
  id: "account-1",
  userId,
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

function postFixture(
  ownerId: string,
  idempotencyKey: string,
  baseText: string,
): PostWithRelations {
  return {
    id: "post-1",
    userId: ownerId,
    baseText,
    status: "DRAFT",
    scheduledAt: null,
    idempotencyKey,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    media: [],
    targets: [],
  } as PostWithRelations;
}

function request(
  idempotencyKey = key,
  baseText = "A saved draft",
  targets: Array<{ accountId: string; adaptedText: string }> = [],
): Request {
  return new Request("http://localhost/api/posts/drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idempotencyKey, baseText, targets, media: [] }),
  });
}

async function run(): Promise<void> {
  const posts = new Map<string, PostWithRelations>();
  let savedTargetCount = 0;
  let updateCount = 0;
  const dependencies: DraftRouteDependencies = {
    getAuthenticatedUser: async () => ({ ok: true, userId }),
    findPostByIdempotencyKey: async (idempotencyKey) =>
      posts.get(idempotencyKey) ?? null,
    findAccounts: async (_userId, accountIds) =>
      accountIds.includes(account.id) ? [account] : [],
    createDraft: async (input) => {
      savedTargetCount = input.targets.length;
      const post = postFixture(input.userId, input.idempotencyKey, input.baseText);
      posts.set(input.idempotencyKey, post);
      return post;
    },
    updateDraft: async (id, input) => {
      updateCount += 1;
      const post = { ...postFixture(input.userId, input.idempotencyKey, input.baseText), id };
      posts.set(input.idempotencyKey, post);
      return post;
    },
  };
  const handler = createDraftRouteHandler(dependencies);

  const unauthenticatedHandler = createDraftRouteHandler({
    ...dependencies,
    getAuthenticatedUser: async () => ({ ok: false as const }),
  });
  assert.equal((await unauthenticatedHandler(request())).status, 401);

  const malformed = await handler(new Request("http://localhost/api/posts/drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idempotencyKey: "not-a-uuid" }),
  }));
  assert.equal(malformed.status, 400);

  const created = await handler(request());
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.post.status, "DRAFT");
  assert.equal(
    createdBody.post.idempotencyKey,
    key,
    "the detail response includes the key required to resume a draft",
  );
  assert.equal(savedTargetCount, 0, "a text-only draft can be saved before selecting accounts");

  const updated = await handler(
    request(key, "Updated draft", [{ accountId: account.id, adaptedText: "Updated draft" }]),
  );
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).post.baseText, "Updated draft");
  assert.equal(updateCount, 1, "subsequent saves update the same draft post");

  posts.set(
    key,
    {
      ...postFixture(userId, key, "Published post"),
      status: "PUBLISHED",
    } as PostWithRelations,
  );
  const published = await handler(request(key, "A later draft change"));
  assert.equal(published.status, 200);
  assert.equal((await published.json()).post.status, "PUBLISHED");
  assert.equal(updateCount, 1, "published posts are never changed by draft saves");

  posts.set(
    "123e4567-e89b-12d3-a456-426614174011",
    postFixture("user-2", "123e4567-e89b-12d3-a456-426614174011", "Foreign draft"),
  );
  const foreign = await handler(
    request("123e4567-e89b-12d3-a456-426614174011"),
  );
  assert.equal(foreign.status, 409);
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
