import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MediaAsset, SocialAccount } from "@prisma/client";
import { LinkedInAdapter } from "../src/lib/platforms/adapters/linkedin";
import type { PublishInput } from "../src/lib/platforms/types";

process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ??
  "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";

function createAccount(overrides: Partial<SocialAccount> = {}): SocialAccount {
  return {
    id: "account-1",
    userId: "user-1",
    platform: "LINKEDIN",
    handle: "Test User",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    scope: "openid profile email w_member_social",
    platformUserId: "urn:li:person:abc123",
    status: "ACTIVE",
    ...overrides,
  };
}

function createInput(overrides: Partial<PublishInput> = {}): PublishInput {
  return {
    targetId: "target-1",
    idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    text: "Hello LinkedIn",
    media: [],
    account: createAccount(),
    ...overrides,
  };
}

async function run(): Promise<void> {
  const uploadDir = path.join("/tmp/opencode", `linkedin-adapter-test-${Date.now()}`);
  await mkdir(uploadDir, { recursive: true });

  const imageFileName = `${randomUUID()}.png`;
  const imageUrl = `https://omnipost.local/api/uploads/${imageFileName}`;
  await writeFile(path.join(uploadDir, imageFileName), Buffer.from("fake-image"));

  const image: MediaAsset = {
    id: "media-1",
    postId: "post-1",
    url: imageUrl,
    type: "IMAGE",
    mimeType: "image/png",
    sizeBytes: 1024,
    width: null,
    height: null,
    order: 0,
  };

  const requests: Request[] = [];
  const originalFetch = global.fetch;

  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    requests.push(request);

    if (request.url.includes("/v2/assets?action=registerUpload")) {
      return new Response(
        JSON.stringify({
          value: {
            asset: "urn:li:digitalmediaAsset:C5605AQExample",
            uploadMechanism: {
              "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
                uploadUrl: "https://api.linkedin.com/mediaUpload/example",
              },
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (request.url.includes("/mediaUpload/example")) {
      return new Response(null, { status: 200 });
    }

    if (request.url.includes("/rest/posts")) {
      return new Response(
        JSON.stringify({ id: "urn:li:share:example123" }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }

    if (request.url.includes("/oauth/v2/accessToken")) {
      return new Response(
        JSON.stringify({
          access_token: "refreshed-access-token",
          expires_in: 3600,
          refresh_token: "refreshed-refresh-token",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("Not found", { status: 404 });
  };

  try {
    const adapter = new LinkedInAdapter({ uploadDir });

    // Validation: text-only post is valid.
    const validation = adapter.validatePost(createInput());
    assert.equal(validation.valid, true);

    // Validation: text over limit is invalid.
    const overLimitText = "a".repeat(3001);
    const overLimit = adapter.validatePost(createInput({ text: overLimitText }));
    assert.equal(overLimit.valid, false);

    // checkAuth is active for non-expired token.
    const auth = await adapter.checkAuth(createAccount());
    assert.equal(auth.active, true);
    assert.ok(auth.account);

    // publishPost text-only succeeds.
    const textResult = await adapter.publishPost(createInput());
    assert.equal(textResult.ok, true);
    if (textResult.ok) {
      assert.ok(textResult.publishedUrl.includes("linkedin.com"));
    }

    const postRequest = requests.find((request) => request.url.includes("/rest/posts"));
    assert.ok(postRequest);
    assert.equal(postRequest?.headers.get("Idempotency-Key"), "target-1:123e4567-e89b-12d3-a456-426614174000");

    // publishPost with image triggers upload flow.
    const imageResult = await adapter.publishPost(createInput({ media: [image] }));
    assert.equal(imageResult.ok, true);

    const registerRequest = requests.find((request) =>
      request.url.includes("/v2/assets?action=registerUpload"),
    );
    assert.ok(registerRequest);

    // fetchAnalytics returns zeros.
    const analytics = await adapter.fetchAnalytics({
      id: "target-1",
      postId: "post-1",
      accountId: "account-1",
      platform: "LINKEDIN",
      adaptedText: "Hello",
      status: "PUBLISHED",
      scheduledAt: null,
      publishedAt: new Date(),
      publishedUrl: "https://linkedin.com",
      error: null,
      attempts: 1,
    });
    assert.deepEqual(analytics, {
      impressions: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    });

    // Auth expiry returns failed result with authExpired flag.
    const errorAdapter = new LinkedInAdapter({
      uploadDir,
      fetch: async (): Promise<Response> =>
        new Response(
          JSON.stringify({ status: 401, message: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
    });

    const originalConsoleError = console.error;
    console.error = () => undefined;
    const authErrorResult = await errorAdapter.publishPost(createInput());
    console.error = originalConsoleError;
    assert.equal(authErrorResult.ok, false);
    if (!authErrorResult.ok) {
      assert.equal(authErrorResult.authExpired, true);
      assert.equal(authErrorResult.retryable, false);
    }
  } finally {
    global.fetch = originalFetch;
  }
  console.log("LinkedIn adapter tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
