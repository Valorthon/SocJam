"use client";

import { PlatformDotGroup } from "@/components/features/posts/PlatformDotGroup";
import type { PostListItemDto } from "@/types";

interface ScheduledPostChipProps {
  post: PostListItemDto;
  timezone: string;
  onClick: () => void;
}

function formatTime(date: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  }
}

export function ScheduledPostChip({
  post,
  timezone,
  onClick,
}: ScheduledPostChipProps) {
  const platforms = post.targets.map((target) => target.platform);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-1.5 rounded border border-border bg-muted/40 px-1.5 py-1 text-left text-xs transition-colors hover:bg-muted/70"
    >
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        {post.scheduledAt ? formatTime(post.scheduledAt, timezone) : "--:--"}
      </span>
      <span className="truncate">{post.baseText || "Media post"}</span>
      <PlatformDotGroup platforms={platforms} />
    </button>
  );
}
