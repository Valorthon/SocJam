import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  decodePageListCookie,
  metaOauthCookies,
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

  const cookie = decodePageListCookie(raw);
  if (!cookie) {
    return NextResponse.json(
      { error: "Your session expired. Please reconnect your Meta account." },
      { status: 410 },
    );
  }

  if (cookie.metaUserId !== authentication.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    metaPageListResponseSchema.parse({
      pages: cookie.pages,
      platform: cookie.platform,
    }),
  );
}