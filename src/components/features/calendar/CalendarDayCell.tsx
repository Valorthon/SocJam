"use client";

import type { PostListItemDto } from "@/types";

import { ScheduledPostChip } from "./ScheduledPostChip";

interface CalendarDayCellProps {
  date: Date;
  timezone: string;
  isCurrentMonth: boolean;
  posts: PostListItemDto[];
  onPostClick: (postId: string) => void;
}

function formatDayNumber(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    day: "numeric",
  }).format(date);
}

export function CalendarDayCell({
  date,
  timezone,
  isCurrentMonth,
  posts,
  onPostClick,
}: CalendarDayCellProps) {
  return (
    <div
      className={`min-h-24 bg-card p-1.5 transition-colors hover:bg-muted/20 sm:min-h-32 sm:p-2 ${
        isCurrentMonth ? "text-foreground" : "text-muted-foreground/60"
      }`}
    >
      <span className="text-xs font-medium">{formatDayNumber(date, timezone)}</span>
      <div className="mt-1 space-y-1">
        {posts.map((post) => (
          <ScheduledPostChip
            key={post.id}
            post={post}
            timezone={timezone}
            onClick={() => onPostClick(post.id)}
          />
        ))}
      </div>
    </div>
  );
}
