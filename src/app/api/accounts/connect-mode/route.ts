import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  PLATFORMS,
  type Platform,
} from "@/lib/platforms/constraints";
import { connectModeFor } from "@/lib/platforms/registry";
import { connectModeResponseSchema } from "@/lib/validations/account";

export async function GET(): Promise<NextResponse> {
  const authentication = await getAuthenticatedUser();
  if (!authentication.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const modes = PLATFORMS.reduce(
    (acc, platform: Platform) => {
      acc[platform] = connectModeFor(platform);
      return acc;
    },
    {} as Record<Platform, "real" | "mock">,
  );

  return NextResponse.json(
    connectModeResponseSchema.parse({ modes }),
  );
}