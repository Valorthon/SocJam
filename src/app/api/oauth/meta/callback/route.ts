import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  decodeState,
  encodePageListCookie,
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
  const response = NextResponse.redirect(url, 302);
  // Consume the state cookie on failure paths too, so a failed/aborted
  // attempt can't leave a stale state around for replay.
  response.cookies.set(metaOauthCookies.state, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
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
  // No plain string pre-compare here: decodeState verifies the HMAC
  // signature with a constant-time compare, which is the real CSRF gate.

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

  // Stash only the slim, token-free picker payload in the page-list cookie.
  // Per-Page access tokens are re-fetched at finalize via listPages(config,
  // userToken) — storing them in a cookie risks exceeding the ~4KB per-cookie
  // browser limit for accounts that manage many Pages, and raw JSON values
  // with spaces/braces break RFC 6265, so we base64url-encode the payload
  // (same safe alphabet the state cookie uses).
  const cookiePayload = {
    metaUserId: state.userId,
    platform: state.platform,
    userToken: longLivedUserToken,
    pages: pages.map((page) => ({
      id: page.id,
      name: page.name,
      hasInstagram: page.instagramBusinessAccountId !== null,
    })),
  };

  const redirectUrl = new URL(
    "/settings/accounts/pick-page",
    process.env.AUTH_URL ?? "http://localhost:3000",
  );

  const response = NextResponse.redirect(redirectUrl, 302);
  // Set cookies directly on the response object — mutations via the cookies()
  // store don't reliably merge into a custom NextResponse.redirect in Next 14,
  // so the browser can silently drop them. response.cookies.set() stamps the
  // Set-Cookie header onto the outgoing 302 deterministically.
  response.cookies.set(
    metaOauthCookies.pageList,
    encodePageListCookie(cookiePayload, config.stateSecret),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: metaOauthCookies.ttlSeconds,
    },
  );
  // Consume the state cookie so it can't be replayed.
  response.cookies.set(metaOauthCookies.state, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}