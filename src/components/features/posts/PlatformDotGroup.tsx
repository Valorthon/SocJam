import {
  PLATFORM_ONBOARDING_DETAILS,
  type Platform,
} from "@/lib/platforms/constraints";

interface PlatformDotGroupProps {
  platforms: Platform[];
}

export function PlatformDotGroup({ platforms }: PlatformDotGroupProps) {
  const uniquePlatforms = Array.from(new Set<Platform>(platforms));

  if (uniquePlatforms.length === 0) {
    return <span className="text-xs text-muted-foreground">No platforms</span>;
  }

  return (
    <div className="flex items-center justify-center gap-1.5" aria-label="Post platforms">
      {uniquePlatforms.map((platform) => {
        const details = PLATFORM_ONBOARDING_DETAILS[platform];

        return (
          <span
            key={platform}
            aria-label={details.name}
            className="size-2.5 rounded-full ring-1 ring-background"
            style={{ backgroundColor: details.color }}
            title={details.name}
          />
        );
      })}
    </div>
  );
}
