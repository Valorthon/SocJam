import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  decodePageListCookie,
  loadMetaConfig,
  metaOauthCookies,
  type PageListCookiePayload,
} from "@/lib/platforms/oauth/meta";
import { metaPageListResponseSchema } from "@/lib/validations/account";

export async function GET(): Promise<NextResponse> {
  const authentication = await getAuthenticatedUser();
  if (!authentication.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(metaOauthCookies.pageList)?.value;
  if (!raw) {
    return NextResponse.json(
      { error: "Your session expired. Please reconnect your Meta account." },
      { status: 410 },
    );
  }

  // The page-list cookie is HMAC-signed; verify it against the state secret.
  let cookie: PageListCookiePayload | null;
  try {
    cookie = decodePageListCookie(raw, loadMetaConfig().stateSecret);
  } catch {
    cookie = null;
  }
  if (!cookie) {
    return NextResponse.json(
      { error: "Your session expired. Please reconnect your Meta account." },
      { status: 410 },
    );
  }

  if (cookie.appUserId !== authentication.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    metaPageListResponseSchema.parse({
      pages: cookie.pages,
      platform: cookie.platform,
    }),
  );
}