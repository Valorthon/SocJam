import assert from "node:assert/strict";
import {
  createConnectModeRouteHandlers,
  type ConnectModeDependencies,
} from "../src/lib/accounts/connect-mode-handlers";

const userId = "user-1";

function authenticatedUser() {
  return async () => ({ ok: true as const, userId });
}

function makeDeps(overrides: Partial<ConnectModeDependencies> = {}): ConnectModeDependencies {
  return {
    getAuthenticatedUser: authenticatedUser(),
    isLinkedInRealEnabled: () => false,
    isTikTokRealEnabled: () => false,
    isFacebookRealEnabled: () => false,
    isInstagramRealEnabled: () => false,
    ...overrides,
  };
}

async function run(): Promise<void> {
  // --- Unauthenticated → 401 ---
  const unauthenticatedHandlers = createConnectModeRouteHandlers({
    ...makeDeps(),
    getAuthenticatedUser: async () => ({ ok: false as const }),
  });
  const unauthResponse = await unauthenticatedHandlers.GET();
  assert.equal(unauthResponse.status, 401);

  // --- All flags mock — every platform resolves to "mock" ---
  const allMockHandlers = createConnectModeRouteHandlers(makeDeps());
  const allMockResponse = await allMockHandlers.GET();
  assert.equal(allMockResponse.status, 200);
  const allMockBody = (await allMockResponse.json()) as { modes: Record<string, string> };
  for (const platform of ["X", "FACEBOOK", "INSTAGRAM", "TIKTOK", "LINKEDIN"]) {
    assert.equal(allMockBody.modes[platform], "mock", `${platform} should be mock`);
  }

  // --- Facebook real ---
  const fbRealHandlers = createConnectModeRouteHandlers(
    makeDeps({ isFacebookRealEnabled: () => true }),
  );
  const fbRealResponse = await fbRealHandlers.GET();
  const fbRealBody = (await fbRealResponse.json()) as { modes: Record<string, string> };
  assert.equal(fbRealBody.modes.FACEBOOK, "real");
  assert.equal(fbRealBody.modes.INSTAGRAM, "mock");
  assert.equal(fbRealBody.modes.LINKEDIN, "mock");

  // --- Instagram real (connect-only; publish stays mock but connect-mode is "real") ---
  const igRealHandlers = createConnectModeRouteHandlers(
    makeDeps({ isInstagramRealEnabled: () => true }),
  );
  const igRealResponse = await igRealHandlers.GET();
  const igRealBody = (await igRealResponse.json()) as { modes: Record<string, string> };
  assert.equal(igRealBody.modes.INSTAGRAM, "real");

  // --- LinkedIn real ---
  const linkedinRealHandlers = createConnectModeRouteHandlers(
    makeDeps({ isLinkedInRealEnabled: () => true }),
  );
  const linkedinRealResponse = await linkedinRealHandlers.GET();
  const linkedinRealBody = (await linkedinRealResponse.json()) as {
    modes: Record<string, string>;
  };
  assert.equal(linkedinRealBody.modes.LINKEDIN, "real");
  assert.equal(linkedinRealBody.modes.FACEBOOK, "mock");

  // --- TikTok real (resolved server-side; the client must never read
  // non-NEXT_PUBLIC env to decide the connect target) ---
  const tiktokRealHandlers = createConnectModeRouteHandlers(
    makeDeps({ isTikTokRealEnabled: () => true }),
  );
  const tiktokRealResponse = await tiktokRealHandlers.GET();
  const tiktokRealBody = (await tiktokRealResponse.json()) as {
    modes: Record<string, string>;
  };
  assert.equal(tiktokRealBody.modes.TIKTOK, "real");
  assert.equal(tiktokRealBody.modes.FACEBOOK, "mock");

  // --- Multiple platforms real at once ---
  const multiRealHandlers = createConnectModeRouteHandlers(
    makeDeps({
      isFacebookRealEnabled: () => true,
      isInstagramRealEnabled: () => true,
      isLinkedInRealEnabled: () => true,
    }),
  );
  const multiRealResponse = await multiRealHandlers.GET();
  const multiRealBody = (await multiRealResponse.json()) as { modes: Record<string, string> };
  assert.equal(multiRealBody.modes.FACEBOOK, "real");
  assert.equal(multiRealBody.modes.INSTAGRAM, "real");
  assert.equal(multiRealBody.modes.LINKEDIN, "real");
  assert.equal(multiRealBody.modes.X, "mock");
  assert.equal(multiRealBody.modes.TIKTOK, "mock");

  // --- Response contains exactly 5 platforms (no extras, no missing) ---
  assert.deepEqual(
    Object.keys(multiRealBody.modes).sort(),
    ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "TIKTOK", "X"],
  );

  console.log("Connect-mode tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});