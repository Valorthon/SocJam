"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  LoaderCircle,
  Play,
  RotateCw,
  Trash2,
} from "lucide-react";

import { PlatformIcon } from "@/components/features/accounts/PlatformIcon";
import { SchedulePicker } from "@/components/features/composer/SchedulePicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePost,
  usePublishPost,
  useRetryPost,
  useUpdatePost,
} from "@/lib/api";
import { PostStatusBadge } from "./PostStatusBadge";
import type { PostDetailDto, PostTargetDto } from "@/types";

interface PostDetailProps {
  postId: string;
  timezone: string;
}

function formatDateTime(date: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  }
}

function TargetRow({ target, timezone }: { target: PostTargetDto; timezone: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <PlatformIcon platform={target.platform} className="size-6" />
        <div>
          <p className="text-sm font-medium">{target.platform}</p>
          {target.scheduledAt ? (
            <p className="text-xs text-muted-foreground">
              {formatDateTime(target.scheduledAt, timezone)}
            </p>
          ) : null}
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-medium uppercase tracking-wide">
          {target.status}
        </p>
        {target.publishedUrl ? (
          <a
            href={target.publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sky-400 hover:underline"
          >
            View post
          </a>
        ) : null}
        {target.error ? (
          <p className="max-w-[12rem] text-xs text-destructive">
            {target.error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ScheduledActions({
  post,
  timezone,
}: {
  post: PostDetailDto;
  timezone: string;
}) {
  const updatePost = useUpdatePost();
  const publishPost = usePublishPost();
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(
    post.scheduledAt,
  );
  const [error, setError] = useState<string | null>(null);

  const handleReschedule = async () => {
    if (!scheduledAt) return;
    setError(null);
    try {
      await updatePost.mutateAsync({
        postId: post.id,
        update: {
          action: "reschedule",
          scheduledAt,
          updatedAt: post.updatedAt,
        },
      });
      setIsRescheduleOpen(false);
    } catch {
      setError("We couldn’t reschedule this post. Please try again.");
    }
  };

  const handleCancel = async () => {
    setError(null);
    try {
      await updatePost.mutateAsync({
        postId: post.id,
        update: { action: "cancel", updatedAt: post.updatedAt },
      });
    } catch {
      setError("We couldn’t cancel this post. Please try again.");
    }
  };

  const handlePublishNow = async () => {
    setError(null);
    try {
      await publishPost.mutateAsync({ postId: post.id });
    } catch {
      setError("We couldn’t publish this post now. Please try again.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsRescheduleOpen(true)}
          disabled={updatePost.isPending || publishPost.isPending}
        >
          <CalendarClock className="mr-2 size-4" />
          Reschedule
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handlePublishNow}
          disabled={updatePost.isPending || publishPost.isPending}
        >
          {publishPost.isPending ? (
            <LoaderCircle className="mr-2 size-4 animate-spin" />
          ) : (
            <Play className="mr-2 size-4" />
          )}
          Publish now
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={handleCancel}
          disabled={updatePost.isPending || publishPost.isPending}
        >
          {updatePost.isPending ? (
            <LoaderCircle className="mr-2 size-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 size-4" />
          )}
          Cancel
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule post</DialogTitle>
            <DialogDescription>
              Choose a new time for this post.
            </DialogDescription>
          </DialogHeader>

          <SchedulePicker
            timezone={timezone}
            value={scheduledAt}
            onChange={setScheduledAt}
          />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRescheduleOpen(false)}
              disabled={updatePost.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleReschedule}
              disabled={!scheduledAt || updatePost.isPending}
            >
              {updatePost.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FailedActions({ post }: { post: PostDetailDto }) {
  const retryPost = useRetryPost();
  const [error, setError] = useState<string | null>(null);

  const handleRetry = async () => {
    setError(null);
    try {
      await retryPost.mutateAsync({ postId: post.id });
    } catch {
      setError("We couldn’t retry the failed targets. Please try again.");
    }
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={handleRetry}
        disabled={retryPost.isPending}
      >
        {retryPost.isPending ? (
          <LoaderCircle className="mr-2 size-4 animate-spin" />
        ) : (
          <RotateCw className="mr-2 size-4" />
        )}
        Retry failed targets
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PostDetail({ postId, timezone }: PostDetailProps) {
  const { data: post, isLoading, error } = usePost(postId);
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error instanceof Error || !post) {
    return (
      <div
        className="rounded-lg border border-destructive/30 bg-destructive/10 p-5"
        role="alert"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-destructive" />
          <h2 className="font-medium text-foreground">Post not found</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {error?.message ?? "We couldn’t load this post."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => router.push("/dashboard")}
        >
          Back to dashboard
        </Button>
      </div>
    );
  }

  return (
    <article className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PostStatusBadge status={post.status} showDot />
          <h1 className="mt-2 text-xl font-semibold">
            {post.baseText || "Media post"}
          </h1>
          {post.scheduledAt ? (
            <p className="text-sm text-muted-foreground">
              Scheduled for {formatDateTime(post.scheduledAt, timezone)}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push("/dashboard")}
        >
          Back
        </Button>
      </div>

      {post.status === "SCHEDULED" ? (
        <ScheduledActions post={post} timezone={timezone} />
      ) : null}
      {post.status === "FAILED" || post.status === "PARTIALLY_FAILED" ? (
        <FailedActions post={post} />
      ) : null}

      {post.media.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {post.media.map((asset) => (
            <div
              key={asset.id}
              className="aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              {asset.type === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.url}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <video src={asset.url} className="size-full object-cover" />
              )}
            </div>
          ))}
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Platforms
        </h2>
        <div className="space-y-2">
          {post.targets.map((target) => (
            <TargetRow key={target.id} target={target} timezone={timezone} />
          ))}
        </div>
      </section>
    </article>
  );
}
