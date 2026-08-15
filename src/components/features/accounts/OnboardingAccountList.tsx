"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { MockConsentDialog } from "@/components/features/accounts/MockConsentDialog";
import {
  PLATFORM_ONBOARDING_DETAILS,
  PLATFORMS,
  type Platform,
} from "@/lib/platforms/constraints";
import { isTikTokRealEnabled } from "@/lib/platforms/config";
import { useConnectMode } from "@/lib/api";

const LINKEDIN_OAUTH_URL = "/api/accounts/oauth/linkedin";
const TIKTOK_OAUTH_URL = "/api/accounts/oauth/tiktok";
const META_OAUTH_START_URL = "/api/oauth/meta/start";

export function OnboardingAccountList() {
  const router = useRouter();
  const connectModeQuery = useConnectMode();
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const modes = connectModeQuery.data?.modes;

  function startConnect(platform: Platform) {
    if (platform === "LINKEDIN" && modes?.[platform] === "real") {
      window.location.href = LINKEDIN_OAUTH_URL;
      return;
    }

if (platform === "TIKTOK" && isTikTokRealEnabled()) {
      window.location.href = TIKTOK_OAUTH_URL;
      return;
    }

    if (
      (platform === "FACEBOOK" || platform === "INSTAGRAM") &&
      modes?.[platform] === "real"
    ) {
      window.location.href = `${META_OAUTH_START_URL}?platform=${platform}`;
      return;
    }

    setSelectedPlatform(platform);
  }

  return (
    <>
      <div className="w-full divide-y divide-border rounded-lg border border-border bg-card px-4 sm:px-6">
        {PLATFORMS.map((platform) => {
          const option = PLATFORM_ONBOARDING_DETAILS[platform];

          return (
            <div
              key={platform}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: option.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{option.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => startConnect(platform)}
              >
                Connect
              </Button>
            </div>
          );
        })}
      </div>

      <MockConsentDialog
        platform={selectedPlatform}
        open={selectedPlatform !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPlatform(null);
        }}
        onConnected={() => router.replace("/dashboard")}
      />
    </>
  );
}