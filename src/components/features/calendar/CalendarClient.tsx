"use client";

import { useRouter } from "next/navigation";

import { CalendarView } from "@/components/features/calendar/CalendarView";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePosts } from "@/lib/api";
import type { PostListItemDto } from "@/types";

interface UpcomingQueueProps {
  posts: PostListItemDto[];
  timezone: string;
  onPostClick: (postId: string) => void;
}

function formatUpcomingTime(date: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  }
}

function UpcomingQueue({ posts, timezone, onPostClick }: UpcomingQueueProps) {
  const upcoming = posts
    .filter(
      (post): post is PostListItemDto & { scheduledAt: string } =>
        post.status === "SCHEDULED" && post.scheduledAt !== null,
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

  return (
    <aside className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Upcoming queue</h3>
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No upcoming scheduled posts.
        </p>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((post) => (
            <li key={post.id}>
              <button
                type="button"
                onClick={() => onPostClick(post.id)}
                className="w-full text-left"
              >
                <p className="text-xs font-medium text-foreground">
                  {formatUpcomingTime(post.scheduledAt, timezone)}
                </p>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {post.baseText || "Media post"}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

interface CalendarClientProps {
  timezone: string;
}

export function CalendarClient({ timezone }: CalendarClientProps) {
  const { data: posts = [], isLoading, error } = usePosts();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/10 p-5"
        role="alert"
      >
        <h2 className="font-medium text-foreground">
          Couldn’t load scheduled posts
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
      <CalendarView
        timezone={timezone}
        posts={posts}
        onPostClick={(postId) => router.push(`/posts/${postId}`)}
      />
      <UpcomingQueue
        timezone={timezone}
        posts={posts}
        onPostClick={(postId) => router.push(`/posts/${postId}`)}
      />
    </div>
  );
}
