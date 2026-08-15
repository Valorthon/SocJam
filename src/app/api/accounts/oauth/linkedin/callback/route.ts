import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { LinkedInAdapter } from "@/lib/platforms/adapters/linkedin";
import {
  exchangeCodeForToken,
  fetchMemberProfile,
} from "@/lib/platforms/oauth/linkedin";
import { encryptToken } from "@/lib/tokens/crypto";
import { db } from "@/lib/db";

const COOKIE_NAME = "linkedin_oauth";

const callbackParamsSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

interface OAuthCookie {
  state: string;
  codeVerifier: string;
}

function parseCookie(value: string | undefined): OAuthCookie | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof parsed.state === "string" &&
      typeof parsed.codeVerifier === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function redirectWithError(error: string): NextResponse {
  const url = new URL("/settings/accounts", process.env.AUTH_URL ?? "http://localhost:3000");
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

function redirectWithSuccess(): NextResponse {
  const url = new URL("/settings/accounts", process.env.AUTH_URL ?? "http://localhost:3000");
  url.searchParams.set("success", "linkedin");
  return NextResponse.redirect(url);
}

export async function GET(request: Request): Promise<NextResponse> {
  const authentication = await getAuthenticatedUser();
  if (!authentication.ok) {
    return redirectWithError("unauthorized");
  }

  const cookieStore = await cookies();
  const cookie = parseCookie(cookieStore.get(COOKIE_NAME)?.value);
  cookieStore.delete(COOKIE_NAME);

  const url = new URL(request.url);
  const params = callbackParamsSchema.parse(Object.fromEntries(url.searchParams));

  if (params.error) {
    return redirectWithError(params.error);
  }

  if (!params.code || !params.state || !cookie) {
    return redirectWithError("invalid_request");
  }

  if (params.state !== cookie.state) {
    return redirectWithError("invalid_state");
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirectWithError("not_configured");
  }

  const redirectUri =
    process.env.LINKEDIN_REDIRECT_URI ??
    `${url.origin}/api/accounts/oauth/linkedin/callback`;

  try {
    const token = await exchangeCodeForToken({
      clientId,
      clientSecret,
      redirectUri,
      code: params.code,
      codeVerifier: cookie.codeVerifier,
    });

    const profile = await fetchMemberProfile(token.access_token);
    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : null;

    const handle = profile.name ?? profile.email ?? profile.sub;
    const platformUserId = `urn:li:person:${profile.sub}`;

    await db.socialAccount.upsert({
      where: {
        userId_platform_handle: {
          userId: authentication.userId,
          platform: "LINKEDIN",
          handle,
        },
      },
      update: {
        accessToken: encryptToken(token.access_token),
        refreshToken: token.refresh_token ? encryptToken(token.refresh_token) : null,
        expiresAt,
        scope: token.scope ?? null,
        platformUserId,
        status: "ACTIVE",
      },
      create: {
        userId: authentication.userId,
        platform: "LINKEDIN",
        handle,
        accessToken: encryptToken(token.access_token),
        refreshToken: token.refresh_token ? encryptToken(token.refresh_token) : null,
        expiresAt,
        scope: token.scope ?? null,
        platformUserId,
        status: "ACTIVE",
      },
    });

    return redirectWithSuccess();
  } catch (error) {
    console.error("LinkedIn OAuth callback failed.", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return redirectWithError("account_already_connected");
    }

    return redirectWithError("unable_to_connect");
  }
}
