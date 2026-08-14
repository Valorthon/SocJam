import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  buildAuthUrl,
  encodeState,
  generatePkceVerifier,
  isMetaConfigured,
  loadMetaConfig,
  metaOauthCookies,
} from "@/lib/platforms/oauth/meta";

const startSchema = z.object({
  platform: z.enum(["FACEBOOK", "INSTAGRAM"]),
});

export async function GET(request: Request): Promise<NextResponse> {
  const authentication = await getAuthenticatedUser();
  if (!authentication.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // IG connect reuses the same FB/IG OAuth handshake: Facebook Login with
  // Instagram scopes. We allow both platforms through the same start route.
  const url = new URL(request.url);
  const input = startSchema.safeParse({ platform: url.searchParams.get("platform") });
  if (!input.success) {
    return NextResponse.json({ error: "Invalid platform." }, { status: 400 });
  }

  if (!isMetaConfigured()) {
    return NextResponse.json(
      { error: "Meta OAuth is not configured on the server." },
      { status: 503 },
    );
  }

  const config = loadMetaConfig();
  const pkceVerifier = generatePkceVerifier();
  const state = encodeState(
    {
      userId: authentication.userId,
      platform: input.data.platform,
      pkceVerifier,
    },
    config.stateSecret,
  );

  const authUrl = buildAuthUrl(config, state, pkceVerifier);

  const response = NextResponse.redirect(authUrl, 302);
  response.cookies.set(metaOauthCookies.state, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: metaOauthCookies.ttlSeconds,
  });

  return response;
}