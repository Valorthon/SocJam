import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { PostListItemDto } from "@/types";

type PostStatus = PostListItemDto["status"];

const STATUS_LABELS: Record<PostStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHING: "Publishing",
  PUBLISHED: "Published",
  PARTIALLY_FAILED: "Partially failed",
  FAILED: "Failed",
};

const STATUS_STYLES: Record<PostStatus, string> = {
  DRAFT: "border-border bg-muted/40 text-muted-foreground",
  SCHEDULED: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  PUBLISHING: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  PUBLISHED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  PARTIALLY_FAILED: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
};

const STATUS_DOT_STYLES: Record<PostStatus, string> = {
  DRAFT: "bg-muted-foreground",
  SCHEDULED: "bg-sky-400",
  PUBLISHING: "bg-amber-400",
  PUBLISHED: "bg-emerald-400",
  PARTIALLY_FAILED: "bg-amber-400",
  FAILED: "bg-destructive",
};

interface PostStatusBadgeProps {
  status: PostStatus;
  showDot?: boolean;
}

export function PostStatusBadge({ status, showDot = false }: PostStatusBadgeProps) {
  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide",
        STATUS_STYLES[status],
      )}
    >
      {showDot ? <span className={cn("size-1.5 rounded-full", STATUS_DOT_STYLES[status])} /> : null}
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function postStatusDotClassName(status: PostStatus): string {
  return STATUS_DOT_STYLES[status];
}
