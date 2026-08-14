import { cn } from "@/lib/utils";

interface PostExcerptProps {
  text: string;
  className?: string;
}

export function PostExcerpt({ text, className }: PostExcerptProps) {
  const excerpt = text.trim() || "Media post";

  return (
    <p className={cn("line-clamp-2 text-sm text-foreground", className)}>
      {excerpt}
    </p>
  );
}
