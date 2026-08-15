import assert from "node:assert/strict";
import type { MediaAsset, SocialAccount } from "@prisma/client";
import {
  createPostsRouteHandlers,
  type PostsRouteDependencies,
} from "../src/lib/posts/route-handlers";
import type { PostWithRelations } from "../src/lib/posts";
import type { MediaInput } from "../src/lib/validations/post";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_SIZE_MESSAGE } from "../src/lib/validations/upload";

const userId = "user-1";
const key = "123e4567-e89b-12d3-a456-426614174000";

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
};

function postFixture(
  ownerId: string,
  idempotencyKey: string,
  status: "DRAFT" | "SCHEDULED" = "DRAFT",
  scheduledAt: Date | null = null,
  media: MediaInput[] = [],
): PostWithRelations {
  return {
    id: "post-1",
    userId: ownerId,
    baseText: "Hello from SocJam",
    status,
    scheduledAt,
    idempotencyKey,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    media: media.map((asset, index) => ({
      ...asset,
      id: `media-${index + 1}`,
      postId: "post-1",
    })) as MediaAsset[],
    targets: [{
      id: "target-1",
      postId: "post-1",
      accountId: account.id,
      platform: "X",
      adaptedText: "Hello from SocJam",
      status: status === "SCHEDULED" ? "SCHEDULED" : "DRAFT",
      scheduledAt,
      publishedAt: null,
      publishedUrl: null,
      error: null,
      attempts: 0,
      account,
    }],
  } as PostWithRelations;
}

function request(idempotencyKey = key, media: MediaInput[] = []): Request {
  return new Request("http://localhost/api/posts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      idempotencyKey,
      baseText: "Hello from SocJam",
      targets: [{ accountId: account.id }],
      media,
    }),
  });
}

async function run(): Promise<void> {
  const posts = new Map<string, PostWithRelations>();
  let activeAccounts = [account];
  let createdMedia: MediaInput[] = [];
  const dependencies: PostsRouteDependencies = {
    getAuthenticatedUser: async () => ({ ok: true, userId }),
    findPostByIdempotencyKey: async (idempotencyKey) =>
      posts.get(idempotencyKey) ?? null,
    findPostsByUser: async () => [],
    findActiveAccounts: async () => activeAccounts,
    getUserTimezone: async () => "UTC",
    createPost: async (input) => {
      createdMedia = input.media;
      const post = postFixture(
        input.userId,
        input.idempotencyKey,
        input.status,
        input.scheduledAt,
        input.media,
      );
      posts.set(input.idempotencyKey, post);
      return post;
    },
  };
  const handlers = createPostsRouteHandlers(dependencies);

  const unauthenticatedHandlers = createPostsRouteHandlers({
    ...dependencies,
    getAuthenticatedUser: async () => ({ ok: false as const }),
  });
  assert.equal((await unauthenticatedHandlers.GET()).status, 401);
  assert.equal((await unauthenticatedHandlers.POST(request())).status, 401);

  const malformed = await handlers.POST(new Request("http://localhost/api/posts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idempotencyKey: key, baseText: "", targets: [] }),
  }));
  assert.equal(malformed.status, 400);

  const media: MediaInput[] = [{
    url: "https://socjam.local/api/uploads/image.png",
    type: "IMAGE",
    mimeType: "image/png",
    sizeBytes: 1024,
    width: null,
    height: null,
    order: 0,
  }];
  const created = await handlers.POST(request(key, media));
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.post.id, "post-1");
  assert.deepEqual(createdMedia, media);
  assert.deepEqual(createdBody.post.media.map((asset: MediaAsset) => asset.url), [media[0].url]);

  const repeated = await handlers.POST(request(key, media));
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).post.id, "post-1");

  const oversizedMedia: MediaInput[] = [{
    ...media[0],
    sizeBytes: MAX_UPLOAD_BYTES + 1,
  }];
  const oversized = await handlers.POST(
    request("123e4567-e89b-12d3-a456-426614174003", oversizedMedia),
  );
  assert.equal(oversized.status, 400);
  assert.deepEqual((await oversized.json()).fieldErrors.media, [MAX_UPLOAD_SIZE_MESSAGE]);

  posts.set(
    "123e4567-e89b-12d3-a456-426614174001",
    postFixture("user-2", "123e4567-e89b-12d3-a456-426614174001"),
  );
  const foreign = await handlers.POST(request("123e4567-e89b-12d3-a456-426614174001"));
  assert.equal(foreign.status, 409);

  activeAccounts = [{ ...account, platform: "INSTAGRAM" }];
  const invalidMedia = await handlers.POST(
    request("123e4567-e89b-12d3-a456-426614174002"),
  );
  assert.equal(invalidMedia.status, 400);
  assert.deepEqual((await invalidMedia.json()).fieldErrors["targets.0"], [
    "Instagram requires an image",
  ]);

  activeAccounts = [account];

  const futureSlot = "2026-12-31T12:30:00.000Z";
  const scheduled = await handlers.POST(
    new Request("http://localhost/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "123e4567-e89b-12d3-a456-426614174004",
        baseText: "Scheduled post",
        targets: [{ accountId: account.id }],
        scheduledAt: futureSlot,
      }),
    }),
  );
  assert.equal(scheduled.status, 201);
  const scheduledBody = await scheduled.json();
  assert.equal(scheduledBody.post.status, "SCHEDULED");
  assert.equal(scheduledBody.post.scheduledAt, futureSlot);
  assert.equal(scheduledBody.post.targets[0].status, "SCHEDULED");

  const pastTime = await handlers.POST(
    new Request("http://localhost/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "123e4567-e89b-12d3-a456-426614174005",
        baseText: "Scheduled post",
        targets: [{ accountId: account.id }],
        scheduledAt: "2020-01-01T12:00:00.000Z",
      }),
    }),
  );
  assert.equal(pastTime.status, 400);

  const invalidInterval = await handlers.POST(
    new Request("http://localhost/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "123e4567-e89b-12d3-a456-426614174006",
        baseText: "Scheduled post",
        targets: [{ accountId: account.id }],
        scheduledAt: "2026-12-31T12:15:00.000Z",
      }),
    }),
  );
  assert.equal(invalidInterval.status, 400);
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
