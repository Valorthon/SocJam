import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { metaOauthCookies } from "@/lib/platforms/oauth/meta";
import { metaPageListResponseSchema } from "@/lib/validations/account";

function readPageListCookie(request: Request): unknown | null {
  const match = request.headers
    .get("cookie")
    ?.match(new RegExp(`${metaOauthCookies.pageList}=([^;]+)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const authentication = await getAuthenticatedUser();
  if (!authentication.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookie = readPageListCookie(request);
  if (!cookie) {
    return NextResponse.json(
      { error: "Your session expired. Please reconnect your Meta account." },
      { status: 410 },
    );
  }

  const parsed = (
    cookie as {
      metaUserId?: string;
      pages?: Array<{ id: string; name: string; access_token: string; hasInstagram: boolean; instagramBusinessAccountId: string | null }>;
    }
  );

  if (!parsed?.metaUserId || parsed.metaUserId !== authentication.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pages = Array.isArray(parsed.pages) ? parsed.pages : [];

  return NextResponse.json(
    metaPageListResponseSchema.parse({ pages }),
  );
}