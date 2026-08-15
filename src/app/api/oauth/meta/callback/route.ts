import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  decodeState,
  exchangeCodeForToken,
  getLongLivedUserToken,
  listPages,
  loadMetaConfig,
  metaOauthCookies,
  type PageSummary,
} from "@/lib/platforms/oauth/meta";

function denyRoute(reason: string): NextResponse {
  const url = new URL(
    "/settings/accounts",
    process.env.AUTH_URL ?? "http://localhost:3000",
  );
  url.searchParams.set("oauth_error", reason);
  return NextResponse.redirect(url, 302);
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const errorCode = url.searchParams.get("error");

  if (errorCode) {
    return denyRoute("oauth_canceled");
  }
  if (!code || !returnedState) {
    return denyRoute("missing_code");
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(metaOauthCookies.state)?.value;
  if (!stateCookie) {
    return denyRoute("missing_state");
  }
  if (stateCookie !== returnedState) {
    return denyRoute("state_mismatch");
  }

  const config = loadMetaConfig();
  const state = decodeState(returnedState, config.stateSecret);
  if (!state) {
    return denyRoute("invalid_state");
  }

  // Exchange the short-lived code for a short-lived token, then upgrade to a
  // long-lived (60-day) user token.
  let longLivedUserToken: string;
  try {
    const shortLived = await exchangeCodeForToken(
      config,
      code,
      state.pkceVerifier,
    );
    if (shortLived.expiresInSeconds === null) {
      // Graph already returned a long-lived token.
      longLivedUserToken = shortLived.accessToken;
    } else {
      const longLived = await getLongLivedUserToken(
        config,
        shortLived.accessToken,
      );
      longLivedUserToken = longLived.accessToken;
    }
  } catch {
    return denyRoute("token_exchange_failed");
  }

  let pages: PageSummary[];
  try {
    pages = await listPages(config, longLivedUserToken);
  } catch {
    return denyRoute("pages_failed");
  }

  if (pages.length === 0) {
    return denyRoute("no_pages");
  }

  // Stash everything we need to finalize in a short-lived cookie. We keep only
  // the per-Page tokens + Page metadata. The user picks a Page next.
  const cookiePayload = {
    metaUserId: state.userId,
    platform: state.platform,
    userTokenForRefresh: longLivedUserToken,
    pages: pages.map((page) => ({
      id: page.id,
      name: page.name,
      access_token: page.accessToken,
      hasInstagram: page.instagramBusinessAccountId !== null,
      instagramBusinessAccountId: page.instagramBusinessAccountId,
    })),
  };

  const redirectUrl = new URL(
    "/settings/accounts/pick-page",
    process.env.AUTH_URL ?? "http://localhost:3000",
  );

  const response = NextResponse.redirect(redirectUrl, 302);
  cookieStore.set(metaOauthCookies.pageList, JSON.stringify(cookiePayload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: metaOauthCookies.ttlSeconds,
  });
  // Consume the state cookie so it can't be replayed.
  cookieStore.set(metaOauthCookies.state, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}