import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { TikTokAdapter } from "@/lib/platforms/adapters/tiktok";
import {
  exchangeCodeForToken,
  fetchCreatorInfo,
  sanitizeOAuthEnvValue,
} from "@/lib/platforms/oauth/tiktok";
import { encryptToken } from "@/lib/tokens/crypto";
import { db } from "@/lib/db";

const COOKIE_NAME = "tiktok_oauth";

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
    if (typeof parsed.state === "string" && typeof parsed.codeVerifier === "string") {
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
  url.searchParams.set("success", "tiktok");
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

  const clientKey = sanitizeOAuthEnvValue(process.env.TIKTOK_CLIENT_KEY);
  const clientSecret = sanitizeOAuthEnvValue(process.env.TIKTOK_CLIENT_SECRET);
  if (!clientKey || !clientSecret) {
    return redirectWithError("not_configured");
  }

  const redirectUri =
    sanitizeOAuthEnvValue(process.env.TIKTOK_REDIRECT_URI) ??
    `${url.origin}/api/accounts/oauth/tiktok/callback`;

  try {
    const token = await exchangeCodeForToken({
      clientKey,
      clientSecret,
      redirectUri,
      code: params.code,
      codeVerifier: cookie.codeVerifier,
    });

    const creatorInfo = await fetchCreatorInfo(token.access_token);
    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : null;

    const handle = creatorInfo.creator_username;
    const platformUserId = token.open_id;

    await db.socialAccount.upsert({
      where: {
        userId_platform_handle: {
          userId: authentication.userId,
          platform: "TIKTOK",
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
        platform: "TIKTOK",
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
    console.error("TikTok OAuth callback failed.", error);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return redirectWithError("account_already_connected");
    }

    return redirectWithError("unable_to_connect");
  }
}
