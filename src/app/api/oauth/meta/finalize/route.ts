import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptToken } from "@/lib/tokens/crypto";
import {
  decodePageListCookie,
  getInstagramAccount,
  listPages,
  loadMetaConfig,
  metaOauthCookies,
} from "@/lib/platforms/oauth/meta";
import { finalizeOauthSchema } from "@/lib/validations/account";

const DAY_SECONDS = 24 * 60 * 60;

export async function POST(request: Request): Promise<NextResponse> {
  const authentication = await getAuthenticatedUser();
  if (!authentication.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const input = finalizeOauthSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(metaOauthCookies.pageList)?.value;
  if (!raw) {
    return NextResponse.json(
      { error: "Your connect session expired. Please try again." },
      { status: 410 },
    );
  }

  const config = loadMetaConfig();
  // The page-list cookie is HMAC-signed; verify it against the state secret.
  const cookie = decodePageListCookie(raw, config.stateSecret);
  if (!cookie) {
    return NextResponse.json(
      { error: "Your connect session expired. Please try again." },
      { status: 410 },
    );
  }

  if (cookie.metaUserId !== authentication.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chosen = cookie.pages.find((item) => item.id === input.data.pageId);
  if (!chosen) {
    return NextResponse.json(
      { error: "Selected page is no longer available." },
      { status: 400 },
    );
  }

  // The slim cookie doesn't carry per-Page access tokens — re-fetch /me/accounts
  // with the long-lived user token to pick up the chosen Page's access token
  // (and its instagram_business_account id for IG connect).
  let pageAccessToken: string;
  let instagramBusinessAccountId: string | null;
  try {
    const freshPages = await listPages(config, cookie.userToken);
    const fresh = freshPages.find((p) => p.id === chosen.id);
    if (!fresh) {
      return NextResponse.json(
        { error: "Selected page is no longer accessible to your Facebook account." },
        { status: 400 },
      );
    }
    pageAccessToken = fresh.accessToken;
    instagramBusinessAccountId = fresh.instagramBusinessAccountId;
  } catch {
    return NextResponse.json(
      { error: "Unable to load Pages from Facebook. Please retry." },
      { status: 502 },
    );
  }

  // FB connect → Page name + Page id; IG connect → @username + IG business
  // account id (requires the Page to have an IG business account linked).
  let handle: string;
  let platformUserId: string;
  if (cookie.platform === "INSTAGRAM") {
    if (!instagramBusinessAccountId) {
      return NextResponse.json(
        {
          error:
            "This Facebook Page does not have an Instagram business account. " +
            "Link one in Meta Business Suite, then try again.",
        },
        { status: 400 },
      );
    }

    try {
      const ig = await getInstagramAccount(
        config,
        instagramBusinessAccountId,
        pageAccessToken,
      );
      handle = `@${ig.username}`;
      platformUserId = ig.id;
    } catch {
      return NextResponse.json(
        { error: "Unable to resolve Instagram account details. Please retry." },
        { status: 502 },
      );
    }
  } else {
    handle = chosen.name;
    platformUserId = chosen.id;
  }

  // Encrypt tokens before persisting. accessToken holds the Page access token
  // (what FB publishPost calls use); refreshToken holds the long-lived user
  // token (refreshed opportunistically + by the refresh-tokens cron).
  let accessTokenEncrypted: string;
  let refreshTokenEncrypted: string;
  try {
    accessTokenEncrypted = encryptToken(pageAccessToken);
    refreshTokenEncrypted = encryptToken(cookie.userToken);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to encrypt tokens." },
      { status: 500 },
    );
  }

  const tokenExpiresAt = new Date(
    Date.now() + 60 * DAY_SECONDS * 1000,
  );

  const scopes = [
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
    "pages_manage_engagement",
    "instagram_basic",
    "instagram_content_publish",
    "business_management",
  ].join(" ");

  try {
    // Match by (userId, platform, platformUserId) — main's migration didn't add
    // a unique constraint on that triple, so use findFirst + update/create.
    const existing = await db.socialAccount.findFirst({
      where: {
        userId: authentication.userId,
        platform: cookie.platform,
        platformUserId,
      },
    });

    const account = existing
      ? await db.socialAccount.update({
          where: { id: existing.id },
          data: {
            handle,
            accessToken: accessTokenEncrypted,
            refreshToken: refreshTokenEncrypted,
            expiresAt: tokenExpiresAt,
            scope: scopes,
            platformUserId,
            status: "ACTIVE",
          },
        })
      : await db.socialAccount.create({
          data: {
            userId: authentication.userId,
            platform: cookie.platform,
            handle,
            accessToken: accessTokenEncrypted,
            refreshToken: refreshTokenEncrypted,
            expiresAt: tokenExpiresAt,
            scope: scopes,
            platformUserId,
            status: "ACTIVE",
          },
        });

    const response = NextResponse.json(
      {
        ok: true,
        accountId: account.id,
        platform: account.platform,
        handle: account.handle,
      },
      { status: 201 },
    );
    // Consume the page-list cookie so finalize can't be replayed. Set the
    // deletion on the response object for deterministic delivery.
    response.cookies.set(metaOauthCookies.pageList, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This account is already connected." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Unable to connect account. Please try again." },
      { status: 500 },
    );
  }
}