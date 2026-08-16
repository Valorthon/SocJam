import { NextResponse } from "next/server";
import type { getAuthenticatedUser } from "@/lib/auth";
import {
  PLATFORMS,
  type Platform,
} from "@/lib/platforms/constraints";
import { connectModeResponseSchema } from "@/lib/validations/account";

export interface ConnectModeDependencies {
  getAuthenticatedUser: typeof getAuthenticatedUser;
  isLinkedInRealEnabled: () => boolean;
  isTikTokRealEnabled: () => boolean;
  isFacebookRealEnabled: () => boolean;
  isInstagramRealEnabled: () => boolean;
}

export function createConnectModeRouteHandlers(
  dependencies: ConnectModeDependencies,
) {
  const realPlatformResolvers: Partial<Record<Platform, () => boolean>> = {
    LINKEDIN: dependencies.isLinkedInRealEnabled,
    TIKTOK: dependencies.isTikTokRealEnabled,
    FACEBOOK: dependencies.isFacebookRealEnabled,
    INSTAGRAM: dependencies.isInstagramRealEnabled,
  };

  return {
    async GET(): Promise<NextResponse> {
      const authentication = await dependencies.getAuthenticatedUser();
      if (!authentication.ok) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const modes = PLATFORMS.reduce(
        (acc, platform: Platform) => {
          const resolver = realPlatformResolvers[platform];
          acc[platform] = resolver?.() ? "real" : "mock";
          return acc;
        },
        {} as Record<Platform, "real" | "mock">,
      );

      return NextResponse.json(
        connectModeResponseSchema.parse({ modes }),
      );
    },
  };
}