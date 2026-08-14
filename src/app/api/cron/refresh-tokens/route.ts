import { NextResponse } from "next/server";
import {
  type AccountStatus,
  type Platform,
} from "@prisma/client";
import { db } from "@/lib/db";
import { decryptToken, encryptToken, EncryptionConfigError } from "@/lib/crypto";
import {
  loadMetaConfig,
  refreshUserToken,
  type MetaConfig,
} from "@/lib/platforms/oauth/meta";

/**
 * Refreshes Meta long-lived user tokens before they expire (~60-day window).
 * Page access tokens created from a long-lived user token don't expire while
 * the user token is valid, so refreshing the user token keeps the Page token
 * live and the account healthy. If refresh fails, we flag the account
 * RECONNECT_REQUIRED — the user sees the reconnect CTA per SPEC §5.3.
 *
 * Secured by the CRON_SECRET header, the same guard used by /publish-due.
 */

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days before expiry.
const DAY_SECONDS = 24 * 60 * 60;

export function isCronRefreshAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim() === "") return false;
  const header = request.headers.get("x-cron-secret");
  if (!header) return false;
  return header === cronSecret;
}

export interface RefreshTokenResult {
  refreshed: number;
  markedReconnect: number;
}

export interface RefreshTokensDependencies {
  findAccounts: () => Promise<
    Array<{
      id: string;
      platform: Platform;
      refreshTokenEncrypted: string;
      tokenExpiresAt: Date;
    }>
  >;
  updateStatus: (accountId: string, status: AccountStatus) => Promise<void>;
  updateRefreshedToken: (
    accountId: string,
    refreshTokenEncrypted: string,
    tokenExpiresAt: Date,
  ) => Promise<void>;
  loadMetaConfig: () => MetaConfig;
  decryptToken: (encoded: string) => string;
  encryptToken: (plaintext: string) => string;
  refreshUserToken: (config: MetaConfig, token: string) => Promise<{
    accessToken: string;
    expiresInSeconds: number;
  }>;
  now?: () => Date;
}

export function createRefreshTokensRunner(dependencies: RefreshTokensDependencies) {
  return async function refreshMetaTokens(): Promise<RefreshTokenResult> {
    const accounts = await dependencies.findAccounts();
    if (accounts.length === 0) {
      return { refreshed: 0, markedReconnect: 0 };
    }

    let config: MetaConfig;
    try {
      config = dependencies.loadMetaConfig();
    } catch {
      throw new Error("Meta OAuth configuration missing.");
    }

    let refreshed = 0;
    let markedReconnect = 0;
    const nowFn = dependencies.now ?? (() => new Date());

    for (const account of accounts) {
      if (!account.refreshTokenEncrypted) continue;

      let userToken: string;
      try {
        userToken = dependencies.decryptToken(account.refreshTokenEncrypted);
      } catch (error) {
        if (error instanceof EncryptionConfigError) {
          await dependencies.updateStatus(account.id, "RECONNECT_REQUIRED");
          markedReconnect += 1;
          continue;
        }
        throw error;
      }

      try {
        const refreshedToken = await dependencies.refreshUserToken(config, userToken);
        const seconds = refreshedToken.expiresInSeconds || 60 * DAY_SECONDS;
        const newExpiry = new Date(nowFn().getTime() + seconds * 1000);
        await dependencies.updateRefreshedToken(
          account.id,
          dependencies.encryptToken(refreshedToken.accessToken),
          newExpiry,
        );
        refreshed += 1;
      } catch {
        // Graph refresh failed. Mark RECONNECT_REQUIRED so the user re-runs OAuth.
        await dependencies.updateStatus(account.id, "RECONNECT_REQUIRED");
        markedReconnect += 1;
      }
    }

    return { refreshed, markedReconnect };
  };
}

const productionRunner = createRefreshTokensRunner({
  findAccounts: async () =>
    db.socialAccount.findMany({
      where: {
        refreshTokenEncrypted: { not: null },
        tokenExpiresAt: { lte: new Date(Date.now() + REFRESH_WINDOW_MS) },
        status: "ACTIVE",
      },
      select: {
        id: true,
        platform: true,
        refreshTokenEncrypted: true,
        tokenExpiresAt: true,
      },
    }) as unknown as Array<{
      id: string;
      platform: Platform;
      refreshTokenEncrypted: string;
      tokenExpiresAt: Date;
    }>,
  updateStatus: async (accountId, status) => {
    await db.socialAccount.update({ where: { id: accountId }, data: { status } });
  },
  updateRefreshedToken: async (accountId, refreshTokenEncrypted, tokenExpiresAt) => {
    await db.socialAccount.update({
      where: { id: accountId },
      data: {
        refreshTokenEncrypted,
        tokenExpiresAt,
        status: "ACTIVE",
      },
    });
  },
  loadMetaConfig,
  decryptToken,
  encryptToken,
  refreshUserToken,
});

export async function POST(request: Request): Promise<NextResponse> {
  if (!isCronRefreshAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await productionRunner();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}