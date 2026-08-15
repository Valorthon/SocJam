import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { metaOauthCookies } from "@/lib/platforms/oauth/meta";
import { metaPageListResponseSchema } from "@/lib/validations/account";

interface PageListCookie {
  metaUserId: string;
  platform: "FACEBOOK" | "INSTAGRAM";
  userTokenForRefresh: string;
  pages: Array<{
    id: string;
    name: string;
    access_token: string;
    hasInstagram: boolean;
    instagramBusinessAccountId: string | null;
  }>;
}

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

  let cookie: PageListCookie;
  try {
    cookie = JSON.parse(raw) as PageListCookie;
  } catch {
    return NextResponse.json(
      { error: "Your session expired. Please reconnect your Meta account." },
      { status: 410 },
    );
  }

  if (!cookie.metaUserId || cookie.metaUserId !== authentication.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pages = Array.isArray(cookie.pages) ? cookie.pages : [];

  return NextResponse.json(
    metaPageListResponseSchema.parse({ pages }),
  );
}