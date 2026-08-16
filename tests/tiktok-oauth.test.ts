import assert from "node:assert/strict";
import {
  buildAuthorizationUrl,
  deriveCodeChallenge,
  exchangeCodeForToken,
  fetchCreatorInfo,
  generateCodeVerifier,
  generateState,
  refreshAccessToken,
} from "../src/lib/platforms/oauth/tiktok";

async function run(): Promise<void> {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = deriveCodeChallenge(codeVerifier);
  assert.ok(state.length > 0);
  assert.ok(codeVerifier.length > 0);
  assert.ok(codeChallenge.length > 0);
  assert.notEqual(state, codeVerifier);

  const url = new URL(
    buildAuthorizationUrl({
      clientKey: "client-key-123",
      redirectUri: "http://localhost:3000/api/accounts/oauth/tiktok/callback",
      state,
      codeChallenge,
    }),
  );

  assert.equal(url.hostname, "www.tiktok.com");
  assert.equal(url.pathname, "/v2/auth/authorize/");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_key"), "client-key-123");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "http://localhost:3000/api/accounts/oauth/tiktok/callback",
  );
  assert.equal(url.searchParams.get("state"), state);
  assert.equal(url.searchParams.get("scope"), "video.publish");
  assert.equal(url.searchParams.get("code_challenge"), codeChallenge);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");

  const requests: Request[] = [];
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    requests.push(request);

    if (request.url.includes("/v2/oauth/token/")) {
      return new Response(
        JSON.stringify({
          access_token: "access-123",
          expires_in: 86400,
          open_id: "open-id-123",
          refresh_expires_in: 31536000,
          refresh_token: "refresh-123",
          scope: "video.publish",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (request.url.includes("/v2/post/publish/creator_info/query/")) {
      return new Response(
        JSON.stringify({
          data: {
            creator_username: "testcreator",
            creator_nickname: "Test Creator",
            creator_avatar_url: "https://example.com/avatar.png",
            privacy_level_options: ["SELF_ONLY", "MUTUAL_FOLLOW_FRIENDS"],
            comment_disabled: false,
            duet_disabled: false,
            stitch_disabled: true,
            max_video_post_duration_sec: 600,
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

    return new Response("Not found", { status: 404 });
  };

  try {
    const token = await exchangeCodeForToken({
      clientKey: "client-key-123",
      clientSecret: "secret-123",
      redirectUri: "http://localhost:3000/api/accounts/oauth/tiktok/callback",
      code: "code-123",
      codeVerifier,
    });

    assert.equal(token.access_token, "access-123");
    assert.equal(token.expires_in, 86400);
    assert.equal(token.open_id, "open-id-123");
    assert.equal(token.refresh_token, "refresh-123");
    assert.equal(token.scope, "video.publish");

    const tokenRequest = requests.find((request) =>
      request.url.includes("/v2/oauth/token/"),
    );
    assert.ok(tokenRequest);
    assert.equal(tokenRequest?.method, "POST");
    const tokenBody = await tokenRequest?.text();
    assert.ok(tokenBody?.includes("grant_type=authorization_code"));
    assert.ok(tokenBody?.includes("client_key=client-key-123"));
    assert.ok(tokenBody?.includes("redirect_uri="));
    assert.ok(tokenBody?.includes("code_verifier=" + codeVerifier));

    const creatorInfo = await fetchCreatorInfo("access-123");
    assert.equal(creatorInfo.creator_username, "testcreator");
    assert.equal(creatorInfo.creator_nickname, "Test Creator");
    assert.deepEqual(creatorInfo.privacy_level_options, [
      "SELF_ONLY",
      "MUTUAL_FOLLOW_FRIENDS",
    ]);

    const refreshed = await refreshAccessToken({
      clientKey: "client-key-123",
      clientSecret: "secret-123",
      refreshToken: "refresh-123",
    });
    assert.equal(refreshed.access_token, "access-123");
  } finally {
    global.fetch = originalFetch;
  }

  console.log("TikTok OAuth tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
