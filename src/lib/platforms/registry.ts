import { type Platform } from "@/lib/platforms/constraints";
import { linkedInAdapter } from "@/lib/platforms/adapters/linkedin";
import { realFacebookAdapter } from "@/lib/platforms/adapters/realFacebook";
import { realInstagramAdapter } from "@/lib/platforms/adapters/realInstagram";
import { mockFacebookAdapter } from "@/lib/platforms/adapters/mockFacebook";
import { mockInstagramAdapter } from "@/lib/platforms/adapters/mockInstagram";
import { mockLinkedInAdapter } from "@/lib/platforms/adapters/mockLinkedIn";
import { mockTikTokAdapter } from "@/lib/platforms/adapters/mockTikTok";
import { mockXAdapter } from "@/lib/platforms/adapters/mockX";
import { tiktokAdapter } from "@/lib/platforms/adapters/tiktok";
import {
  isFacebookRealEnabled,
  isInstagramRealEnabled,
  isLinkedInRealEnabled,
  isTikTokRealEnabled,
} from "@/lib/platforms/config";
import { type SocialPlatformAdapter } from "@/lib/platforms/types";

const mockAdapters: Record<Platform, SocialPlatformAdapter> = {
  X: mockXAdapter,
  FACEBOOK: mockFacebookAdapter,
  INSTAGRAM: mockInstagramAdapter,
  TIKTOK: mockTikTokAdapter,
  LINKEDIN: mockLinkedInAdapter,
};

export function getPlatformAdapter(platform: Platform): SocialPlatformAdapter {
  if (platform === "LINKEDIN" && isLinkedInRealEnabled()) {
    return linkedInAdapter;
  }

  if (platform === "TIKTOK" && isTikTokRealEnabled()) {
    return tiktokAdapter;
  }

  if (platform === "FACEBOOK" && isFacebookRealEnabled()) {
    return realFacebookAdapter;
  }

  if (platform === "INSTAGRAM" && isInstagramRealEnabled()) {
    return realInstagramAdapter;
  }

  if (process.env.MOCK_PLATFORMS !== "true") {
    throw new Error(
      `Mock platform adapters are disabled and ${platform} real adapter is not configured.`,
    );
  }

  return mockAdapters[platform];
}
