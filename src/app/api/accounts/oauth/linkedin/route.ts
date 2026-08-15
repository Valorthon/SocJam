import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  buildAuthorizationUrl,
  deriveCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "@/lib/platforms/oauth/linkedin";

const COOKIE_NAME = "linkedin_oauth";
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
  return `${url.origin}/api/accounts/oauth/linkedin/callback`;
}

export async function GET(request: Request): Promise<NextResponse> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "LinkedIn OAuth is not configured." },
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
    path: "/api/accounts/oauth/linkedin/callback",
  });

  const redirectUri = process.env.LINKEDIN_REDIRECT_URI ?? buildRedirectUri(request);
  const authorizationUrl = buildAuthorizationUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge,
  });

  return NextResponse.redirect(authorizationUrl);
}
