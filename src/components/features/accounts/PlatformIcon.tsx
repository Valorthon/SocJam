import type { IconType } from "react-icons";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaTiktok,
  FaXTwitter,
} from "react-icons/fa6";

import { cn } from "@/lib/utils";
import {
  PLATFORM_ONBOARDING_DETAILS,
  type Platform,
} from "@/lib/platforms/constraints";

interface PlatformIconProps {
  platform: Platform;
  className?: string;
}

const PLATFORM_ICONS: Record<Platform, IconType> = {
  X: FaXTwitter,
  FACEBOOK: FaFacebookF,
  INSTAGRAM: FaInstagram,
  TIKTOK: FaTiktok,
  LINKEDIN: FaLinkedinIn,
};

export function PlatformIcon({ platform, className }: PlatformIconProps) {
  const details = PLATFORM_ONBOARDING_DETAILS[platform];
  const Icon = PLATFORM_ICONS[platform];

  return (
    <span
      aria-label={details.name}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full",
        platform === "X" ? "text-background" : "text-white",
        className,
      )}
      style={{ backgroundColor: details.color }}
      title={details.name}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}
