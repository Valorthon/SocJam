import { type Platform } from "@/lib/platforms/constraints";
import { mockFacebookAdapter } from "@/lib/platforms/adapters/mockFacebook";
import { mockInstagramAdapter } from "@/lib/platforms/adapters/mockInstagram";
import { mockLinkedInAdapter } from "@/lib/platforms/adapters/mockLinkedIn";
import { mockTikTokAdapter } from "@/lib/platforms/adapters/mockTikTok";
import { mockXAdapter } from "@/lib/platforms/adapters/mockX";
import { type SocialPlatformAdapter } from "@/lib/platforms/types";

const mockAdapters: Record<Platform, SocialPlatformAdapter> = {
  X: mockXAdapter,
  FACEBOOK: mockFacebookAdapter,
  INSTAGRAM: mockInstagramAdapter,
  TIKTOK: mockTikTokAdapter,
  LINKEDIN: mockLinkedInAdapter,
};

export function getPlatformAdapter(platform: Platform): SocialPlatformAdapter {
  if (process.env.MOCK_PLATFORMS !== "true") {
    throw new Error("Mock platform adapters are disabled and real adapters are not configured.");
  }

  return mockAdapters[platform];
}
