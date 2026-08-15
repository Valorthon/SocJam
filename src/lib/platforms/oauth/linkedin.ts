import { createHash, randomBytes } from "crypto";
import { z } from "zod";

const LINKEDIN_AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

export const LINKEDIN_OAUTH_SCOPES = ["openid", "profile", "email", "w_member_social"];

const tokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().int().nonnegative().optional(),
  refresh_token: z.string().optional(),
  refresh_token_expires_in: z.number().int().nonnegative().optional(),
  scope: z.string().optional(),
});

const userinfoResponseSchema = z.object({
  sub: z.string(),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  picture: z.string().optional(),
  email: z.string().email().optional(),
  email_verified: z.boolean().optional(),
});

export type LinkedInTokenResponse = z.infer<typeof tokenResponseSchema>;
export type LinkedInUserinfoResponse = z.infer<typeof userinfoResponseSchema>;

function base64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

export function generateState(): string {
  return base64url(randomBytes(32));
}

export function deriveCodeChallenge(codeVerifier: string): string {
  return base64url(createHash("sha256").update(codeVerifier).digest());
}

interface AuthorizationUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes?: string[];
}

export function buildAuthorizationUrl(input: AuthorizationUrlInput): string {
  const url = new URL(LINKEDIN_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", (input.scopes ?? LINKEDIN_OAUTH_SCOPES).join(" "));
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

interface ExchangeCodeInput {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}

export async function exchangeCodeForToken(
  input: ExchangeCodeInput,
): Promise<LinkedInTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code_verifier: input.codeVerifier,
  });

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`LinkedIn token exchange failed: ${response.status}`);
  }

  return tokenResponseSchema.parse(data);
}

interface RefreshTokenInput {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export async function refreshAccessToken(
  input: RefreshTokenInput,
): Promise<LinkedInTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
  });

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`LinkedIn token refresh failed: ${response.status}`);
  }

  return tokenResponseSchema.parse(data);
}

export async function fetchMemberProfile(
  accessToken: string,
): Promise<LinkedInUserinfoResponse> {
  const response = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(`LinkedIn profile fetch failed: ${response.status}`);
  }

  return userinfoResponseSchema.parse(data);
}

export function buildMemberUrn(memberId: string): string {
  return `urn:li:person:${memberId}`;
}
