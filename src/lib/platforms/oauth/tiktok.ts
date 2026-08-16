import { createHash, randomBytes } from "crypto";
import { z } from "zod";

const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_CREATOR_INFO_URL =
  "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";

export const TIKTOK_OAUTH_SCOPES = ["video.publish"];

function base64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

export function generateState(): string {
  return base64url(randomBytes(32));
}

export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

export function deriveCodeChallenge(codeVerifier: string): string {
  return base64url(createHash("sha256").update(codeVerifier).digest());
}

const tokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().int().nonnegative().optional(),
  open_id: z.string(),
  refresh_expires_in: z.number().int().nonnegative().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

const tokenErrorResponseSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
  log_id: z.string().optional(),
});

const creatorInfoResponseSchema = z.object({
  data: z.object({
    creator_avatar_url: z.string().optional(),
    creator_username: z.string(),
    creator_nickname: z.string().optional(),
    privacy_level_options: z.array(z.string()),
    comment_disabled: z.boolean().optional(),
    duet_disabled: z.boolean().optional(),
    stitch_disabled: z.boolean().optional(),
    max_video_post_duration_sec: z.number().int().nonnegative().optional(),
  }),
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
    log_id: z.string().optional(),
  }),
});

export type TikTokTokenResponse = z.infer<typeof tokenResponseSchema>;
export type TikTokCreatorInfoResponse = z.infer<
  typeof creatorInfoResponseSchema
>;

interface AuthorizationUrlInput {
  clientKey: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
  codeChallenge?: string;
}

export function buildAuthorizationUrl(input: AuthorizationUrlInput): string {
  const url = new URL(TIKTOK_AUTHORIZE_URL);
  url.searchParams.set("client_key", input.clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    (input.scopes ?? TIKTOK_OAUTH_SCOPES).join(","),
  );
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  if (input.codeChallenge) {
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

interface ExchangeCodeInput {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier?: string;
}

export async function exchangeCodeForToken(
  input: ExchangeCodeInput,
): Promise<TikTokTokenResponse> {
  const body = new URLSearchParams({
    client_key: input.clientKey,
    client_secret: input.clientSecret,
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
  });
  if (input.codeVerifier) {
    body.set("code_verifier", input.codeVerifier);
  }

  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data: unknown = await response.json();
  if (!response.ok) {
    const parsedError = tokenErrorResponseSchema.safeParse(data);
    const description = parsedError.success
      ? `${parsedError.data.error}${parsedError.data.error_description ? `: ${parsedError.data.error_description}` : ""}`
      : `TikTok token exchange failed: ${response.status}`;
    throw new Error(description);
  }

  return tokenResponseSchema.parse(data);
}

interface RefreshTokenInput {
  clientKey: string;
  clientSecret: string;
  refreshToken: string;
}

export async function refreshAccessToken(
  input: RefreshTokenInput,
): Promise<TikTokTokenResponse> {
  const body = new URLSearchParams({
    client_key: input.clientKey,
    client_secret: input.clientSecret,
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
  });

  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data: unknown = await response.json();
  if (!response.ok) {
    const parsedError = tokenErrorResponseSchema.safeParse(data);
    const description = parsedError.success
      ? `${parsedError.data.error}${parsedError.data.error_description ? `: ${parsedError.data.error_description}` : ""}`
      : `TikTok token refresh failed: ${response.status}`;
    throw new Error(description);
  }

  return tokenResponseSchema.parse(data);
}

export async function fetchCreatorInfo(
  accessToken: string,
): Promise<TikTokCreatorInfoResponse["data"]> {
  const response = await fetch(TIKTOK_CREATOR_INFO_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({}),
  });

  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`TikTok creator info fetch failed: ${response.status}`);
  }

  const parsed = creatorInfoResponseSchema.parse(data);
  if (parsed.error.code !== "ok") {
    throw new Error(
      `TikTok creator info fetch failed: ${parsed.error.code}${parsed.error.message ? ` - ${parsed.error.message}` : ""}`,
    );
  }

  return parsed.data;
}

export function sanitizeOAuthEnvValue(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.trim().replace(/^["']+|["']+$/g, "");
}
