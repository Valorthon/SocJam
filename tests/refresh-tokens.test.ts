import assert from "node:assert/strict";
import { type Platform } from "@prisma/client";
import {
  createRefreshTokensRunner,
  isCronRefreshAuthorized,
  META_REFRESH_PLATFORMS,
  metaRefreshAccountsWhere,
  type RefreshTokensDependencies,
} from "../src/app/api/cron/refresh-tokens/route";

const ORIGINAL_SECRET = process.env.CRON_SECRET;

const fakeConfig = {
  appId: "id",
  appSecret: "secret",
  redirectUri: "callback",
  graphApiVersion: "v19.0",
  stateSecret: "secret",
};

interface TestAccount {
  id: string;
  platform: Platform;
  refreshToken: string;
  expiresAt: Date;
}

function makeDeps(overrides: Partial<RefreshTokensDependencies>): RefreshTokensDependencies {
  return {
    findAccounts: async () => [] as TestAccount[],
    updateStatus: async () => {},
    updateRefreshedToken: async () => {},
    loadMetaConfig: () => fakeConfig,
    decryptToken: (s) => s,
    encryptToken: (s) => s,
    refreshUserToken: async () => ({
      accessToken: "new-token",
      expiresInSeconds: 60 * 24 * 60 * 60,
    }),
    ...overrides,
  };
}

async function run(): Promise<void> {
  try {
    // --- Secret guard ---
    delete process.env.CRON_SECRET;
    assert.equal(isCronRefreshAuthorized(new Request("http://localhost")), false);
    assert.equal(
      isCronRefreshAuthorized(new Request("http://localhost", { headers: { "x-cron-secret": "anything" } })),
      false,
    );

    process.env.CRON_SECRET = "  ";
    assert.equal(
      isCronRefreshAuthorized(new Request("http://localhost", { headers: { "x-cron-secret": "anything" } })),
      false,
    );

    process.env.CRON_SECRET = "my-cron-secret";
    assert.equal(
      isCronRefreshAuthorized(new Request("http://localhost", { headers: { "x-cron-secret": "my-cron-secret" } })),
      true,
    );
    assert.equal(
      isCronRefreshAuthorized(new Request("http://localhost", { headers: { "x-cron-secret": "WRONG" } })),
      false,
    );
    assert.equal(isCronRefreshAuthorized(new Request("http://localhost")), false);

    // --- Empty account list → no-op result, zero callbacks.
    let calls = 0;
    const empty = await createRefreshTokensRunner(
      makeDeps({
        findAccounts: async () => [] as TestAccount[],
        updateStatus: async () => { calls += 1; },
        updateRefreshedToken: async () => { calls += 1; },
      }),
    )();
    assert.deepEqual(empty, { refreshed: 0, markedReconnect: 0 });
    assert.equal(calls, 0);

    // --- Happy path: refresh + write new token, no status change.
    let wroteId = "";
    let wroteEnc = "";
    const happy = await createRefreshTokensRunner(
      makeDeps({
        findAccounts: async () => [
          {
            id: "acc-a",
            platform: "FACEBOOK",
            refreshToken: "user-a",
            expiresAt: new Date(Date.now() + 1),
          },
        ],
        updateRefreshedToken: async (id, enc, exp) => {
          wroteId = id;
          wroteEnc = enc;
          assert.ok(exp.getTime() > Date.now());
        },
        decryptToken: (s) => `dec:${s}`,
        encryptToken: (s) => `enc:${s}`,
        refreshUserToken: async (_cfg, t) => ({
          accessToken: `ref:${t}`,
          expiresInSeconds: 60 * 24 * 60 * 60,
        }),
      }),
    )();
    assert.deepEqual(happy, { refreshed: 1, markedReconnect: 0 });
    assert.equal(wroteId, "acc-a");
    assert.equal(wroteEnc, "enc:ref:dec:user-a");

    // --- Decrypt failure → marked RECONNECT_REQUIRED, processing continues.
    let reconnects = 0;
    let decrypted = 0;
    const mixed = await createRefreshTokensRunner(
      makeDeps({
        findAccounts: async () => [
          {
            id: "acc-dec",
            platform: "FACEBOOK",
            refreshToken: "x",
            expiresAt: new Date(),
          },
          {
            id: "acc-ok",
            platform: "FACEBOOK",
            refreshToken: "y",
            expiresAt: new Date(),
          },
        ],
        updateStatus: async (id) => {
          if (id === "acc-dec") reconnects += 1;
        },
        updateRefreshedToken: async () => {},
        decryptToken: () => {
          decrypted += 1;
          if (decrypted === 1) throw new Error("decrypt failed (tampering)");
          return "ok";
        },
        refreshUserToken: async () => ({ accessToken: "fresh", expiresInSeconds: 100 }),
      }),
    )();
    assert.deepEqual(mixed, { refreshed: 1, markedReconnect: 1 });
    assert.equal(reconnects, 1);

    // --- Graph refresh failure → RECONNECT_REQUIRED, no token write.
    let refreshUpdateCalls = 0;
    let statusFails = 0;
    const failed = await createRefreshTokensRunner(
      makeDeps({
        findAccounts: async () => [
          {
            id: "acc-fail",
            platform: "FACEBOOK",
            refreshToken: "x",
            expiresAt: new Date(),
          },
        ],
        updateStatus: async () => { statusFails += 1; },
        updateRefreshedToken: async () => { refreshUpdateCalls += 1; },
        refreshUserToken: async () => {
          throw new Error("graph 401");
        },
      }),
    )();
    assert.deepEqual(failed, { refreshed: 0, markedReconnect: 1 });
    assert.equal(statusFails, 1);
    assert.equal(refreshUpdateCalls, 0);

    // --- Missing Meta config → thrown error surfaces.
    try {
      await createRefreshTokensRunner(
        makeDeps({
          findAccounts: async () => [
            {
              id: "anything",
              platform: "FACEBOOK",
              refreshToken: "x",
              expiresAt: new Date(),
            },
          ],
          loadMetaConfig: () => {
            throw new Error("Meta OAuth configuration missing.");
          },
        }),
      )();
      assert.fail("misconfigured Meta config should propagate");
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes("Meta OAuth configuration"));
    }

    // --- Production query never selects non-Meta accounts.
    assert.deepEqual(META_REFRESH_PLATFORMS, ["FACEBOOK", "INSTAGRAM"]);
    const where = metaRefreshAccountsWhere(new Date("2026-01-01T00:00:00Z"));
    assert.deepEqual(where.platform.in, ["FACEBOOK", "INSTAGRAM"]);
    for (const nonMeta of ["LINKEDIN", "TIKTOK", "X"] as Platform[]) {
      assert.equal(
        (where.platform.in as Platform[]).includes(nonMeta),
        false,
        `${nonMeta} must never be selected by the refresh-tokens cron`,
      );
    }
    assert.equal(where.refreshToken.not, null);
    assert.equal(where.status, "ACTIVE");

    console.log("Refresh-tokens tests passed.");
  } finally {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = ORIGINAL_SECRET;
    }
  }
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});