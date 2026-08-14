import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptToken, EncryptionConfigError } from "@/lib/crypto";
import { getInstagramAccount, loadMetaConfig, metaOauthCookies } from "@/lib/platforms/oauth/meta";
import { finalizeOauthSchema, metaPageSchema } from "@/lib/validations/account";

interface PageListCookie {
  metaUserId: string;
  platform: "FACEBOOK" | "INSTAGRAM";
  userTokenForRefresh: string;
  pages: Array<z.infer<typeof metaPageSchema>>;
}

function readPageListCookie(request: Request): PageListCookie | null {
  const match = request.headers
    .get("cookie")
    ?.match(new RegExp(`${metaOauthCookies.pageList}=([^;]+)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as PageListCookie;
  } catch {
    return null;
  }
}

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

  const cookie = readPageListCookie(request);
  if (!cookie || cookie.metaUserId !== authentication.userId) {
    return NextResponse.json(
      { error: "Your connect session expired. Please try again." },
      { status: 410 },
    );
  }

  const page = cookie.pages.find((item) => item.id === input.data.pageId);
  if (!page) {
    return NextResponse.json({ error: "Selected page is no longer available." }, { status: 400 });
  }

  // Compute the handle + externalAccountId appropriate for the platform chosen
  // at OAuth start. FB connect → Page name + Page id; IG connect → IG
  // @username + IG business account id (requires the Page to have an IG
  // business account linked, otherwise the connect is rejected).
  let handle: string;
  let externalAccountId: string;
  if (cookie.platform === "INSTAGRAM") {
    if (!page.instagramBusinessAccountId) {
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
        loadMetaConfig(),
        page.instagramBusinessAccountId,
        page.access_token,
      );
      handle = `@${ig.username}`;
      externalAccountId = ig.id;
    } catch {
      return NextResponse.json(
        { error: "Unable to resolve Instagram account details. Please retry." },
        { status: 502 },
      );
    }
  } else {
    handle = page.name;
    externalAccountId = page.id;
  }

  // Encrypt the tokens before persisting. accessToken holds the Page access
  // token (the one FB publishPost calls use); refreshTokenEncrypted holds the
  // long-lived user token, refreshed weekly by /api/cron/refresh-tokens.
  let accessTokenEncrypted: string;
  let refreshTokenEncrypted: string;
  try {
    accessTokenEncrypted = encryptToken(page.access_token);
    refreshTokenEncrypted = encryptToken(cookie.userTokenForRefresh);
  } catch (error) {
    if (error instanceof EncryptionConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unable to encrypt tokens." }, { status: 500 });
  }

  const tokenExpiresAt = new Date(Date.now() + 60 * DAY_SECONDS * 1000);

  try {
    const account = await db.socialAccount.upsert({
      where: {
        userId_platform_externalAccountId: {
          userId: authentication.userId,
          platform: cookie.platform,
          externalAccountId,
        },
      },
      // If the user is reconnecting an existing account (which has
      // externalAccountId from before), update its tokens and flip status back
      // to ACTIVE. Otherwise create a fresh row.
      update: {
        handle,
        accessToken: accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
        status: "ACTIVE",
      },
      create: {
        userId: authentication.userId,
        platform: cookie.platform,
        handle,
        accessToken: accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
        externalAccountId,
        status: "ACTIVE",
      },
    });

    const response = NextResponse.json(
      { ok: true, accountId: account.id, platform: account.platform, handle: account.handle },
      { status: 201 },
    );
    // Consume the page-list cookie so finalize can't be replayed.
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