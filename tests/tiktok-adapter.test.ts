import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MediaAsset, SocialAccount } from "@prisma/client";
import { TikTokAdapter } from "../src/lib/platforms/adapters/tiktok";
import type { PublishInput } from "../src/lib/platforms/types";

process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ??
  "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";

function createAccount(overrides: Partial<SocialAccount> = {}): SocialAccount {
  return {
    id: "account-1",
    userId: "user-1",
    platform: "TIKTOK",
    handle: "testcreator",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    scope: "video.publish",
    platformUserId: "open-id-123",
    status: "ACTIVE",
    ...overrides,
  };
}

function createInput(overrides: Partial<PublishInput> = {}): PublishInput {
  return {
    targetId: "target-1",
    idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    text: "Hello TikTok",
    media: [],
    account: createAccount(),
    ...overrides,
  };
}

async function run(): Promise<void> {
  const uploadDir = path.join("/tmp/opencode", `tiktok-adapter-test-${Date.now()}`);
  await mkdir(uploadDir, { recursive: true });

  const videoFileName = `${randomUUID()}.mp4`;
  const videoUrl = `https://omnipost.local/api/uploads/${videoFileName}`;
  await writeFile(path.join(uploadDir, videoFileName), Buffer.from("fake-video"));

  const video: MediaAsset = {
    id: "media-1",
    postId: "post-1",
    url: videoUrl,
    type: "VIDEO",
    mimeType: "video/mp4",
    sizeBytes: 1024,
    width: null,
    height: null,
    order: 0,
  };

  const requests: Request[] = [];
  const originalFetch = global.fetch;
  let statusPollCount = 0;

  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    requests.push(request);

    if (request.url.includes("/v2/post/publish/video/init/")) {
      return new Response(
        JSON.stringify({
          data: {
            publish_id: "v_pub_file~v2-1.123456789",
            upload_url: "https://open-upload.tiktokapis.com/video/?upload_id=67890",
          },
          error: {
            code: "ok",
            message: "",
            log_id: "202210112248442CB9319E1FB30C1073F3",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (request.url.includes("open-upload.tiktokapis.com")) {
      return new Response(null, { status: 200 });
    }

    if (request.url.includes("/v2/post/publish/status/fetch/")) {
      statusPollCount += 1;
      const status = statusPollCount === 1 ? "PROCESSING_UPLOAD" : "PUBLISH_COMPLETE";
      return new Response(
        JSON.stringify({
          data: { status },
          error: {
            code: "ok",
            message: "",
            log_id: "202210112248442CB9319E1FB30C1073F3",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (request.url.includes("/v2/oauth/token/")) {
      return new Response(
        JSON.stringify({
          access_token: "refreshed-access-token",
          expires_in: 86400,
          open_id: "open-id-123",
          refresh_token: "refreshed-refresh-token",
          scope: "video.publish",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("Not found", { status: 404 });
  };

  try {
    const adapter = new TikTokAdapter({ uploadDir, pollIntervalMs: 10 });

    // Validation: text-only post is invalid because video is required.
    const textOnlyValidation = adapter.validatePost(createInput());
    assert.equal(textOnlyValidation.valid, false);
    assert.ok(textOnlyValidation.errors.some((error) => error.includes("video")));

    // Validation: video post is valid.
    const videoValidation = adapter.validatePost(createInput({ media: [video] }));
    assert.equal(videoValidation.valid, true);

    // checkAuth is active for non-expired token.
    const auth = await adapter.checkAuth(createAccount());
    assert.equal(auth.active, true);
    assert.ok(auth.account);

    // publishPost with video succeeds after init, upload, and polling.
    const result = await adapter.publishPost(createInput({ media: [video] }));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.publishedUrl, "https://www.tiktok.com/@testcreator");
    }

    const initRequest = requests.find((request) =>
      request.url.includes("/v2/post/publish/video/init/"),
    );
    assert.ok(initRequest);
    const initBody = await initRequest?.json();
    assert.equal(initBody.post_info.privacy_level, "SELF_ONLY");
    assert.equal(initBody.post_info.title, "Hello TikTok");
    assert.equal(initBody.source_info.source, "FILE_UPLOAD");
    assert.equal(initBody.source_info.total_chunk_count, 1);

    const uploadRequest = requests.find((request) =>
      request.url.includes("open-upload.tiktokapis.com"),
    );
    assert.ok(uploadRequest);
    assert.equal(uploadRequest?.method, "PUT");
    assert.equal(uploadRequest?.headers.get("Content-Type"), "video/mp4");

    const statusRequest = requests.filter((request) =>
      request.url.includes("/v2/post/publish/status/fetch/"),
    );
    assert.equal(statusRequest.length, 2);

    // fetchAnalytics returns zeros.
    const analytics = await adapter.fetchAnalytics({
      id: "target-1",
      postId: "post-1",
      accountId: "account-1",
      platform: "TIKTOK",
      adaptedText: "Hello",
      status: "PUBLISHED",
      scheduledAt: null,
      publishedAt: new Date(),
      publishedUrl: "https://tiktok.com",
      error: null,
      attempts: 1,
    });
    assert.deepEqual(analytics, {
      impressions: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    });

    // Missing video returns non-retryable error.
    const missingVideoResult = await adapter.publishPost(createInput());
    assert.equal(missingVideoResult.ok, false);
    if (!missingVideoResult.ok) {
      assert.equal(missingVideoResult.retryable, false);
    }

    // publishPost returns failed result when status polling reports failure.
    const failureAdapter = new TikTokAdapter({
      uploadDir,
      pollIntervalMs: 10,
      fetch: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = new Request(input, init);
        requests.push(request);

        if (request.url.includes("/v2/post/publish/video/init/")) {
          return new Response(
            JSON.stringify({
              data: {
                publish_id: "v_pub_file~v2-fail",
                upload_url: "https://open-upload.tiktokapis.com/video/?upload_id=fail",
              },
              error: {
                code: "ok",
                message: "",
                log_id: "202210112248442CB9319E1FB30C1073F3",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (request.url.includes("open-upload.tiktokapis.com")) {
          return new Response(null, { status: 200 });
        }

        if (request.url.includes("/v2/post/publish/status/fetch/")) {
          return new Response(
            JSON.stringify({
              data: { status: "FAILED", fail_reason: "file_format_check_failed" },
              error: {
                code: "ok",
                message: "",
                log_id: "202210112248442CB9319E1FB30C1073F3",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response("Not found", { status: 404 });
      },
    });

    const failureResult = await failureAdapter.publishPost(
      createInput({ targetId: "target-fail", media: [video] }),
    );
    assert.equal(failureResult.ok, false);
    if (!failureResult.ok) {
      assert.equal(failureResult.retryable, false);
    }

    // Auth expiry returns failed result with authExpired flag.
    const authErrorAdapter = new TikTokAdapter({
      uploadDir,
      fetch: async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            error: {
              code: "access_token_invalid",
              message: "Unauthorized",
              log_id: "202210112248442CB9319E1FB30C1073F3",
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
    });

    const originalConsoleError = console.error;
    console.error = () => undefined;
    const authErrorResult = await authErrorAdapter.publishPost(createInput({ media: [video] }));
    console.error = originalConsoleError;
    assert.equal(authErrorResult.ok, false);
    if (!authErrorResult.ok) {
      assert.equal(authErrorResult.authExpired, true);
      assert.equal(authErrorResult.retryable, false);
    }

    // Internal/retryable failure reason marks result retryable.
    const retryableAdapter = new TikTokAdapter({
      uploadDir,
      pollIntervalMs: 10,
      fetch: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const request = new Request(input, init);
        requests.push(request);

        if (request.url.includes("/v2/post/publish/video/init/")) {
          return new Response(
            JSON.stringify({
              data: {
                publish_id: "v_pub_file~v2-retry",
                upload_url: "https://open-upload.tiktokapis.com/video/?upload_id=retry",
              },
              error: {
                code: "ok",
                message: "",
                log_id: "202210112248442CB9319E1FB30C1073F3",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (request.url.includes("open-upload.tiktokapis.com")) {
          return new Response(null, { status: 200 });
        }

        if (request.url.includes("/v2/post/publish/status/fetch/")) {
          return new Response(
            JSON.stringify({
              data: { status: "FAILED", fail_reason: "internal" },
              error: {
                code: "ok",
                message: "",
                log_id: "202210112248442CB9319E1FB30C1073F3",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response("Not found", { status: 404 });
      },
    });

    const retryableResult = await retryableAdapter.publishPost(
      createInput({ targetId: "target-retry", media: [video] }),
    );
    assert.equal(retryableResult.ok, false);
    if (!retryableResult.ok) {
      assert.equal(retryableResult.retryable, true);
    }
  } finally {
    global.fetch = originalFetch;
  }

  console.log("TikTok adapter tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
