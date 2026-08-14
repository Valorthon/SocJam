import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

type Trend = "up" | "down" | "neutral";

interface TrendBadgeProps {
  value: string;
  trend?: Trend;
}

const trendClassNames: Record<Trend, string> = {
  up: "text-emerald-300",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

const trendLabels: Record<Trend, string> = {
  up: "Increased",
  down: "Decreased",
  neutral: "No change",
};

const trendIcons = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: Minus,
} as const;

export function TrendBadge({ value, trend = "neutral" }: TrendBadgeProps) {
  const TrendIcon = trendIcons[trend];

  return (
    <span
      aria-label={`${trendLabels[trend]} by ${value}`}
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-[11px] font-medium tabular-nums",
        trendClassNames[trend],
      )}
    >
      <TrendIcon aria-hidden="true" className="size-3" />
      {value}
    </span>
  );
}
