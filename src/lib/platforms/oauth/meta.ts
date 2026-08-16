import { randomBytes, createHmac, createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Meta (Facebook/Instagram) OAuth 2.0 helpers + Graph API calls.
 *
 * The flow we implement here is:
 *   1. `/start` redirects the user to facebook.com with a signed `state` blob
 *      (user id, platform, PKCE verifier) and PKCE `code_challenge`.
 *   2. Meta bounces the user back to `/callback` with `code` + `state`. We
 *      verify `state`, exchange `code` for a short-lived user access token,
 *      then upgrade it to a long-lived (60-day) user token.
 *   3. `/callback` lists the User's Pages via `/me/accounts`, finds any IG
 *      business accounts tied to those Pages, and reflects everything to a
 *      short-lived signed cookie. The user is then taken to `/pick-page`.
 *   4. `/finalize` reads the cookie, encrypts the chosen Page/IG tokens, and
 *      creates the `SocialAccount` row(s).
 *
 * Why PKCE + signed state: PKCE protects against code interception; the
 * HMAC-signed `state` cookie ties the OAuth callback to the logged-in user
 * and prevents CSRF (a third party can't forge a `state` we'll accept).
 */

export interface MetaConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  graphApiVersion: string;
  stateSecret: string;
}

const SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_manage_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
].join(" ");

const STATE_COOKIE = "op_meta_oauth";
const PAGE_LIST_COOKIE = "op_meta_pages";
const COOKIE_TTL_SECONDS = 5 * 60; // 5 minutes — short by design.
const HMAC_ALGORITHM = "sha256";

class MetaConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaConfigError";
  }
}

export function loadMetaConfig(): MetaConfig {
  const missing: string[] = [];
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;
  const graphApiVersion = process.env.META_GRAPH_API_VERSION;
  const stateSecret = process.env.AUTH_SECRET;

  if (!appId) missing.push("META_APP_ID");
  if (!appSecret) missing.push("META_APP_SECRET");
  if (!redirectUri) missing.push("META_REDIRECT_URI");
  if (!graphApiVersion) missing.push("META_GRAPH_API_VERSION");
  if (!stateSecret) missing.push("AUTH_SECRET (used as state HMAC key)");

  if (
    !appId ||
    !appSecret ||
    !redirectUri ||
    !graphApiVersion ||
    !stateSecret ||
    missing.length > 0
  ) {
    throw new MetaConfigError(
      `Meta OAuth is misconfigured. Missing env vars: ${missing.join(", ")}.`,
    );
  }

  return {
    appId,
    appSecret,
    redirectUri,
    graphApiVersion,
    stateSecret,
  };
}

export function isMetaConfigured(): boolean {
  return Boolean(
    process.env.META_APP_ID &&
      process.env.META_APP_SECRET &&
      process.env.META_REDIRECT_URI &&
      process.env.AUTH_SECRET,
  );
}

export function generatePkceVerifier(): string {
  // 32 random bytes → 43-char base64url string — minimum length Meta accepts.
  return randomBytes(32).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  // S256: base64url(sha256(verifier)), with no padding. Required by Meta for
  // apps that mandate PKCE; works for any app.
  return createHash("sha256").update(verifier).digest("base64url");
}

const statePayloadSchema = z.object({
  userId: z.string().min(1),
  platform: z.enum(["FACEBOOK", "INSTAGRAM"]),
  pkceVerifier: z.string().min(43).max(128),
});

export type StatePayload = z.infer<typeof statePayloadSchema>;

function sign(value: string, secret: string): string {
  return createHmac(HMAC_ALGORITHM, secret).update(value).digest("base64url");
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function encodeState(payload: StatePayload, secret: string): string {
  const body = encodeBase64Url(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export function decodeState(
  token: string,
  secret: string,
): StatePayload | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expectedSignature = sign(body, secret);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length) return null;
  if (!timingSafeEqual(received, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Url(body));
  } catch {
    return null;
  }

  const result = statePayloadSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export function buildAuthUrl(
  config: MetaConfig,
  state: string,
  pkceVerifier: string,
): string {
  const challenge = pkceChallenge(pkceVerifier);
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    state,
    scope: SCOPES,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return new URL(
    `https://www.facebook.com/${config.graphApiVersion}/dialog/oauth?${params.toString()}`,
  ).toString();
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().int().positive().optional(),
});

export interface TokenResponse {
  accessToken: string;
  expiresInSeconds: number | null;
}

export async function exchangeCodeForToken(
  config: MetaConfig,
  code: string,
  pkceVerifier: string,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code,
    code_verifier: pkceVerifier,
  });

  const response = await fetch(
    `https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(
      `Meta token exchange failed with HTTP ${response.status}.`,
    );
  }

  const parsed = tokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Meta token exchange returned an unexpected payload.");
  }

  return {
    accessToken: parsed.data.access_token,
    expiresInSeconds: parsed.data.expires_in ?? null,
  };
}

const longLivedTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().int().positive(),
});

export interface LongLivedToken {
  accessToken: string;
  expiresInSeconds: number;
}

export async function getLongLivedUserToken(
  config: MetaConfig,
  shortLivedToken: string,
): Promise<LongLivedToken> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/${config.graphApiVersion}/oauth/access_token?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Meta long-lived token exchange failed with HTTP ${response.status}.`);
  }

  const parsed = longLivedTokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Meta long-lived token exchange returned an unexpected payload.");
  }

  return {
    accessToken: parsed.data.access_token,
    expiresInSeconds: parsed.data.expires_in,
  };
}

const pageShapeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  access_token: z.string().min(1),
  // Instagram business account (if any) is nested under `instagram_business_account`.
  instagram_business_account: z
    .object({ id: z.string().min(1) })
    .nullable()
    .optional(),
});

const pageListResponseSchema = z.object({
  data: z.array(pageShapeSchema),
});

export interface PageSummary {
  id: string;
  name: string;
  accessToken: string;
  instagramBusinessAccountId: string | null;
}

export async function listPages(
  config: MetaConfig,
  userAccessToken: string,
): Promise<PageSummary[]> {
  const url = new URL(
    `https://graph.facebook.com/${config.graphApiVersion}/me/accounts`,
  );
  url.searchParams.set("access_token", userAccessToken);
  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account",
  );

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Meta /me/accounts failed with HTTP ${response.status}.`);
  }

  const parsed = pageListResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Meta /me/accounts returned an unexpected payload.");
  }

  return parsed.data.data.map((page) => ({
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
    instagramBusinessAccountId: page.instagram_business_account?.id ?? null,
  }));
}

const instagramAccountResponseSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
});

export interface InstagramAccountSummary {
  id: string;
  username: string;
}

export async function getInstagramAccount(
  config: MetaConfig,
  instagramBusinessAccountId: string,
  pageAccessToken: string,
): Promise<InstagramAccountSummary> {
  const url = new URL(
    `https://graph.facebook.com/${config.graphApiVersion}/${instagramBusinessAccountId}`,
  );
  url.searchParams.set("fields", "id,username");
  url.searchParams.set("access_token", pageAccessToken);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Meta IG account lookup failed with HTTP ${response.status}.`);
  }

  const parsed = instagramAccountResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Meta IG account lookup returned an unexpected payload.");
  }

  return { id: parsed.data.id, username: parsed.data.username };
}

export async function refreshUserToken(
  config: MetaConfig,
  longLivedToken: string,
): Promise<LongLivedToken> {
  // Meta long-lived user tokens are refreshed via the same fb_exchange_token
  // grant but require an already-long-lived token.
  return getLongLivedUserToken(config, longLivedToken);
}

export const metaOauthCookies = {
  state: STATE_COOKIE,
  pageList: PAGE_LIST_COOKIE,
  ttlSeconds: COOKIE_TTL_SECONDS,
} as const;

/**
 * Intermediate page-list cookie payload.
 *
 * Stored as an HMAC-signed, base64url-encoded envelope (`body.signature`,
 * same shape as the state cookie — signature verified with a constant-time
 * compare before the payload is trusted) using the RFC 4648 §5 safe alphabet
 * for cookie values. Slimmed to only what the picker UI + finalize need.
 * Per-Page access tokens are NOT kept here — finalize re-fetches `listPages`
 * with `userToken` to grab the chosen Page's access token at finalize time.
 * This keeps the cookie well under the browser's ~4KB per-cookie limit even
 * for accounts that manage many Pages (each Page contributes only ~60 bytes
 * here vs. ~350 with a token).
 */
export interface PageListCookiePayload {
  metaUserId: string;
  platform: "FACEBOOK" | "INSTAGRAM";
  userToken: string;
  pages: Array<{ id: string; name: string; hasInstagram: boolean }>;
}

const pageListCookiePayloadSchema = z.object({
  metaUserId: z.string().min(1),
  platform: z.enum(["FACEBOOK", "INSTAGRAM"]),
  userToken: z.string().min(1),
  pages: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      hasInstagram: z.boolean(),
    }),
  ),
});

export function encodePageListCookie(
  payload: PageListCookiePayload,
  secret: string,
): string {
  const body = encodeBase64Url(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export function decodePageListCookie(
  raw: string,
  secret: string,
): PageListCookiePayload | null {
  if (!raw || typeof raw !== "string") return null;
  // HMAC-signed envelope (same shape as the state cookie): the signature is
  // verified with a constant-time compare before the payload is trusted, so
  // a tampered or forged cookie is rejected as an expired session.
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);

  const expectedSignature = sign(body, secret);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length) return null;
  if (!timingSafeEqual(received, expected)) return null;

  try {
    const json = decodeBase64Url(body);
    const parsed = pageListCookiePayloadSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}