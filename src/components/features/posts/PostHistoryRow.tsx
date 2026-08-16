import { LoaderCircle, RotateCw } from "lucide-react";
import Link from "next/link";

import { PlatformDotGroup } from "@/components/features/posts/PlatformDotGroup";
import { PostExcerpt } from "@/components/features/posts/PostExcerpt";
import {
  PostStatusBadge,
  postStatusDotClassName,
} from "@/components/features/posts/PostStatusBadge";
import { Button } from "@/components/ui/button";
import { getDraftComposerHref } from "@/lib/posts/draft-resume";
import type { PostListItemDto } from "@/types";

interface PostHistoryRowProps {
  post: PostListItemDto;
  dateLabel: string;
  onRetry: (postId: string) => void;
  isRetrying: boolean;
  isRetryDisabled: boolean;
}

export function PostHistoryRow({
  post,
  dateLabel,
  onRetry,
  isRetrying,
  isRetryDisabled,
}: PostHistoryRowProps) {
  const canRetry = post.status === "FAILED" || post.status === "PARTIALLY_FAILED";
  const draftHref = getDraftComposerHref(post);
  const detailHref = post.status === "DRAFT" ? null : `/posts/${post.id}`;

  return (
    <article className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 px-4 py-4 transition-colors hover:bg-muted/30 md:grid-cols-[auto_minmax(0,1fr)_6rem_8.5rem_10rem] md:items-center md:gap-4">
      {draftHref ? (
        <Link
          href={draftHref}
          className="absolute inset-0 z-10 cursor-pointer rounded-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
          aria-label="Continue editing draft"
        />
      ) : detailHref ? (
        <Link
          href={detailHref}
          className="absolute inset-0 z-10 cursor-pointer rounded-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
          aria-label="View post details"
        />
      ) : null}
      <span
        aria-label={`${post.status.toLowerCase().replaceAll("_", " ")} status`}
        className={`mt-1.5 size-2 shrink-0 rounded-full md:mt-0 ${postStatusDotClassName(post.status)}`}
      />

      <PostExcerpt text={post.baseText} />

      <div className="col-start-2 flex items-center justify-between gap-3 md:col-start-auto md:justify-center">
        <span className="text-xs text-muted-foreground md:hidden">Platforms</span>
        <PlatformDotGroup platforms={post.targets.map((target) => target.platform)} />
      </div>

      <div className="col-start-2 flex items-center justify-between gap-3 md:col-start-auto md:justify-center">
        <span className="text-xs text-muted-foreground md:hidden">Status</span>
        <PostStatusBadge status={post.status} />
      </div>

      <div className="col-start-2 flex items-center justify-between gap-3 md:col-start-auto md:justify-end">
        {canRetry ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-auto gap-1 px-0 py-0 text-destructive hover:bg-transparent hover:text-destructive"
            disabled={isRetryDisabled}
            aria-label="Retry failed targets for this post"
            onClick={() => onRetry(post.id)}
          >
            {isRetrying ? (
              <LoaderCircle className="size-3 animate-spin" />
            ) : (
              <RotateCw className="size-3" />
            )}
            {isRetrying ? "Retrying…" : "Retry"}
          </Button>
        ) : null}
        <time
          className="font-mono text-xs text-muted-foreground"
          dateTime={post.scheduledAt ?? post.createdAt}
        >
          {dateLabel}
        </time>
      </div>
    </article>
  );
}
