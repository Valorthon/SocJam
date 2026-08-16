import type { SocialAccount } from "@prisma/client";

import { decryptToken, encryptToken } from "@/lib/tokens/crypto";
import {
  loadMetaConfig,
  refreshUserToken,
  type MetaConfig,
} from "@/lib/platforms/oauth/meta";

/**
 * Shared Meta Graph API helpers used by both the Facebook and Instagram real
 * adapters: Graph error parsing/classification, Graph API version resolution,
 * and opportunistic long-lived user-token refresh. Kept here (not inlined in
 * each adapter) so the two adapters never drift apart on error semantics.
 */

export const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
export const GRAPH_API_VERSION_DEFAULT = "v19.0";

export function getFetch(): typeof fetch {
  return fetch;
}

export function graphVersion(): string {
  return process.env.META_GRAPH_API_VERSION ?? GRAPH_API_VERSION_DEFAULT;
}

export interface GraphError {
  status: number;
  message: string;
  type?: string;
  code?: number;
  subcode?: number;
}

export async function parseGraphError(
  response: Response,
  defaultMessage: string,
): Promise<GraphError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    return { status: response.status, message: defaultMessage };
  }

  const errorBody = body as {
    error?: { message?: string; type?: string; code?: number; error_subcode?: number };
  };
  const metaError = errorBody?.error;

  return {
    status: response.status,
    message: metaError?.message ?? defaultMessage,
    type: metaError?.type,
    code: metaError?.code,
    subcode: metaError?.error_subcode,
  };
}

export function isAuthExpiredError(error: GraphError): boolean {
  if (error.status === 401) return true;
  // 190: OAuth exception, 463: expired, 460: password changed, 467: invalid.
  return error.code === 190 || error.code === 463 || error.code === 460 || error.code === 467;
}

export function isRateLimited(error: GraphError): boolean {
  if (error.status === 429) return true;
  // 4: usage-throttle, 17: user-request-limit, 32: app-limit, 613: rate limit.
  return error.code === 4 || error.code === 17 || error.code === 32 || error.code === 613;
}

export function isRetryable(error: GraphError): boolean {
  if (error.status >= 500) return true;
  return isRateLimited(error);
}

export interface EnsureFreshTokenDeps {
  loadMetaConfig: () => MetaConfig;
  refreshUserToken: typeof refreshUserToken;
  decryptToken: typeof decryptToken;
  encryptToken: typeof encryptToken;
  now: () => Date;
}

/**
 * Opportunistic refresh of the long-lived Meta user token. If the user token
 * is within TOKEN_EXPIRY_BUFFER_MS of expiry and a refreshToken is present,
 * exchange it for a fresh long-lived token, re-encrypt it, persist the new
 * token + expiry, flip status to ACTIVE, and return the updated account. Page
 * access tokens (in `accessToken`) don't change during this refresh — they
 * remain valid as long as the user token is valid.
 */
export async function ensureFreshMetaToken(
  account: SocialAccount,
  deps: EnsureFreshTokenDeps,
): Promise<SocialAccount> {
  const isNearExpiry =
    account.expiresAt !== null &&
    account.expiresAt.getTime() - TOKEN_EXPIRY_BUFFER_MS <= deps.now().getTime();

  if (!isNearExpiry || !account.refreshToken) {
    return account;
  }

  const config = deps.loadMetaConfig();
  const refreshToken = deps.decryptToken(account.refreshToken);

  const refreshed = await deps.refreshUserToken(config, refreshToken);

  const newExpiresAt = refreshed.expiresInSeconds
    ? new Date(deps.now().getTime() + refreshed.expiresInSeconds * 1000)
    : account.expiresAt;

  const encryptedRefreshToken = deps.encryptToken(refreshed.accessToken);

  const { db } = await import("@/lib/db");
  const updated = await db.socialAccount.update({
    where: { id: account.id },
    data: {
      refreshToken: encryptedRefreshToken,
      expiresAt: newExpiresAt,
      status: "ACTIVE",
    },
  });

  return updated;
}

export function platformUserIdOrFail(account: SocialAccount, platformName: string): string {
  if (!account.platformUserId) {
    throw new Error(`${platformName} account is missing its platform id (platformUserId).`);
  }
  return account.platformUserId;
}