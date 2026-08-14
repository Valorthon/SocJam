import assert from "node:assert/strict";
import {
  buildAuthUrl,
  decodeState,
  encodeState,
  generatePkceVerifier,
  pkceChallenge,
  type MetaConfig,
} from "../src/lib/platforms/oauth/meta";

const config: MetaConfig = {
  appId: "1234567890",
  appSecret: "secret",
  redirectUri: "http://localhost:3000/api/oauth/meta/callback",
  graphApiVersion: "v19.0",
  stateSecret: "test-state-secret",
};

async function run(): Promise<void> {
  // PKCE: verifier is 43 chars (base64url of 32 bytes); challenge is S256.
  const verifier = generatePkceVerifier();
  assert.equal(verifier.length, 43);
  const challenge = pkceChallenge(verifier);
  assert.ok(challenge.length >= 43);
  assert.notEqual(challenge, verifier, "S256 challenge must differ from verifier");

  // State round trip.
  const state = encodeState(
    { userId: "user-1", platform: "FACEBOOK", pkceVerifier: verifier },
    config.stateSecret,
  );
  const decoded = decodeState(state, config.stateSecret);
  assert.deepEqual(decoded, {
    userId: "user-1",
    platform: "FACEBOOK",
    pkceVerifier: verifier,
  });

  // State tampering is rejected.
  const tampered = state.slice(0, state.length - 2) + "AB";
  assert.equal(decodeState(tampered, config.stateSecret), null);

  // State signed with a different secret is rejected.
  assert.equal(decodeState(state, "different-secret"), null);

  // Malformed state returns null instead of throwing.
  assert.equal(decodeState("", config.stateSecret), null);
  assert.equal(decodeState("not-a-valid-state", config.stateSecret), null);
  assert.equal(decodeState("aaa.bbb", config.stateSecret), null);

  // Auth URL contains required OAuth params.
  const url = buildAuthUrl(config, state, verifier);
  assert.ok(url.startsWith("https://www.facebook.com/v19.0/dialog/oauth?"));
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("client_id"), config.appId);
  assert.equal(parsed.searchParams.get("redirect_uri"), config.redirectUri);
  assert.equal(parsed.searchParams.get("state"), state);
  assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
  assert.equal(parsed.searchParams.get("code_challenge"), challenge);
  // Scopes include Page-publish + IG.
  const scope = parsed.searchParams.get("scope") ?? "";
  assert.ok(scope.includes("pages_manage_posts"));
  assert.ok(scope.includes("instagram_content_publish"));

  console.log("Meta OAuth test passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});