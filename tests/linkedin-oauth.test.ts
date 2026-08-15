import assert from "node:assert/strict";
import {
  buildAuthorizationUrl,
  buildMemberUrn,
  deriveCodeChallenge,
  exchangeCodeForToken,
  fetchMemberProfile,
  generateCodeVerifier,
  generateState,
  refreshAccessToken,
} from "../src/lib/platforms/oauth/linkedin";

async function run(): Promise<void> {
  // State and verifier generation
  const state = generateState();
  const verifier = generateCodeVerifier();
  const challenge = deriveCodeChallenge(verifier);

  assert.ok(state.length > 0);
  assert.ok(verifier.length > 0);
  assert.ok(challenge.length > 0);
  assert.notEqual(state, verifier);

  // Authorization URL
  const url = new URL(
    buildAuthorizationUrl({
      clientId: "client-123",
      redirectUri: "http://localhost:3000/callback",
      state,
      codeChallenge: challenge,
    }),
  );

  assert.equal(url.hostname, "www.linkedin.com");
  assert.equal(url.pathname, "/oauth/v2/authorization");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "client-123");
  assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/callback");
  assert.equal(url.searchParams.get("state"), state);
  assert.equal(url.searchParams.get("code_challenge"), challenge);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(url.searchParams.get("scope")?.includes("w_member_social"));

  // Member URN
  assert.equal(buildMemberUrn("abc123"), "urn:li:person:abc123");

  // Mocked fetch
  const requests: Request[] = [];
  const originalFetch = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    requests.push(request);

    if (request.url.includes("/oauth/v2/accessToken")) {
      return new Response(
        JSON.stringify({
          access_token: "access-123",
          expires_in: 3600,
          refresh_token: "refresh-123",
          scope: "openid profile email w_member_social",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (request.url.includes("/v2/userinfo")) {
      return new Response(
        JSON.stringify({
          sub: "abc123",
          name: "Test User",
          email: "test@example.com",
          email_verified: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("Not found", { status: 404 });
  };

  try {
    // Token exchange
    const token = await exchangeCodeForToken({
      clientId: "client-123",
      clientSecret: "secret-123",
      redirectUri: "http://localhost:3000/callback",
      code: "code-123",
      codeVerifier: verifier,
    });

    assert.equal(token.access_token, "access-123");
    assert.equal(token.expires_in, 3600);
    assert.equal(token.refresh_token, "refresh-123");

    const tokenRequest = requests.find((request) =>
      request.url.includes("/oauth/v2/accessToken"),
    );
    assert.ok(tokenRequest);
    assert.equal(tokenRequest?.method, "POST");
    const tokenBody = await tokenRequest?.text();
    assert.ok(tokenBody?.includes("grant_type=authorization_code"));
    assert.ok(tokenBody?.includes("code_verifier=" + verifier));

    // Profile fetch
    const profile = await fetchMemberProfile("access-123");
    assert.equal(profile.sub, "abc123");
    assert.equal(profile.name, "Test User");

    // Refresh
    const refreshed = await refreshAccessToken({
      clientId: "client-123",
      clientSecret: "secret-123",
      refreshToken: "refresh-123",
    });
    assert.equal(refreshed.access_token, "access-123");
  } finally {
    global.fetch = originalFetch;
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
