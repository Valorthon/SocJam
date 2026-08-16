import { NextResponse } from "next/server";
import {
  type AccountStatus,
  type Platform,
} from "@prisma/client";
import { db } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/tokens/crypto";
import {
  loadMetaConfig,
  refreshUserToken,
  type MetaConfig,
} from "@/lib/platforms/oauth/meta";

/**
 * Refreshes Meta long-lived user tokens before they expire (~60-day window).
 * This is the defense-in-depth companion to the opportunistic refresh in
 * RealFacebookAdapter.ensureFreshToken — it catches accounts whose tokens
 * would tick down to expiry with no in-flow trigger (e.g. a draft never
 * published again). If refresh fails, the account is flagged
 * RECONNECT_REQUIRED per SPEC §5.3.
 *
 * Secured by the CRON_SECRET header — the same guard used by /publish-due.
 */

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
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
      refreshToken: string;
      expiresAt: Date;
    }>
  >;
  updateStatus: (accountId: string, status: AccountStatus) => Promise<void>;
  updateRefreshedToken: (
    accountId: string,
    refreshToken: string,
    expiresAt: Date,
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
      if (!account.refreshToken) continue;

      let userToken: string;
      try {
        userToken = dependencies.decryptToken(account.refreshToken);
      } catch {
        // Decrypt failure (tampering, key mismatch, corrupt token) — treat
        // as auth-expired so the user sees the reconnect CTA (SPEC §5.3).
        await dependencies.updateStatus(account.id, "RECONNECT_REQUIRED");
        markedReconnect += 1;
        continue;
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
        await dependencies.updateStatus(account.id, "RECONNECT_REQUIRED");
        markedReconnect += 1;
      }
    }

    return { refreshed, markedReconnect };
  };
}

/**
 * Meta platforms whose long-lived user tokens are refreshable via
 * fb_exchange_token. Non-Meta accounts (LinkedIn, TikTok) must never be
 * selected — their refresh tokens would be sent to Meta's endpoint, the
 * exchange would fail, and they'd be wrongly flipped to RECONNECT_REQUIRED.
 */
export const META_REFRESH_PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM"];

export function metaRefreshAccountsWhere(now: Date = new Date()) {
  return {
    platform: { in: META_REFRESH_PLATFORMS },
    refreshToken: { not: null },
    expiresAt: { lte: new Date(now.getTime() + REFRESH_WINDOW_MS) },
    status: "ACTIVE" as const,
  };
}

const productionRunner = createRefreshTokensRunner({
  findAccounts: async () =>
    db.socialAccount.findMany({
      where: metaRefreshAccountsWhere(),
      select: {
        id: true,
        platform: true,
        refreshToken: true,
        expiresAt: true,
      },
    }) as unknown as Array<{
      id: string;
      platform: Platform;
      refreshToken: string;
      expiresAt: Date;
    }>,
  updateStatus: async (accountId, status) => {
    await db.socialAccount.update({ where: { id: accountId }, data: { status } });
  },
  updateRefreshedToken: async (accountId, refreshToken, expiresAt) => {
    await db.socialAccount.update({
      where: { id: accountId },
      data: {
        refreshToken,
        expiresAt,
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