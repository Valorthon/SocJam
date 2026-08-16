import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildAuthorizationUrl,
  deriveCodeChallenge,
  generateCodeVerifier,
  generateState,
  sanitizeOAuthEnvValue,
} from "@/lib/platforms/oauth/tiktok";

const COOKIE_NAME = "tiktok_oauth";
const COOKIE_MAX_AGE_SECONDS = 5 * 60;

interface OAuthCookie {
  state: string;
  codeVerifier: string;
}

function serializeCookie(value: OAuthCookie): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function buildRedirectUri(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/api/accounts/oauth/tiktok/callback`;
}

export async function GET(request: Request): Promise<NextResponse> {
  const clientKey = sanitizeOAuthEnvValue(process.env.TIKTOK_CLIENT_KEY);
  if (!clientKey) {
    return NextResponse.json(
      { error: "TikTok OAuth is not configured." },
      { status: 500 },
    );
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = deriveCodeChallenge(codeVerifier);

  const cookieStore = await cookies();
  cookieStore.set({
    name: COOKIE_NAME,
    value: serializeCookie({ state, codeVerifier }),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/api/accounts/oauth/tiktok/callback",
  });

  const redirectUri = process.env.TIKTOK_REDIRECT_URI ?? buildRedirectUri(request);
  const authorizationUrl = buildAuthorizationUrl({
    clientKey,
    redirectUri,
    state,
    codeChallenge,
  });

  return NextResponse.redirect(authorizationUrl);
}
