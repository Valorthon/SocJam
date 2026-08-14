import { TrendBadge } from "./TrendBadge";
import { Badge } from "@/components/ui/badge";

interface MetricsCardProps {
  label: string;
  value: string;
  numericValue: number;
  trend: string;
  trendDirection?: "up" | "down" | "neutral";
  isStale?: boolean;
}

export function MetricsCard({
  label,
  value,
  numericValue,
  trend,
  trendDirection = "neutral",
  isStale = false,
}: MetricsCardProps) {
  return (
    <article className="min-w-0 rounded-lg border border-border bg-card p-5 transition-colors hover:bg-accent/40">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {isStale ? (
          <Badge className="shrink-0 border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-amber-300">
            Stale
          </Badge>
        ) : null}
      </div>
      <div className="flex items-baseline gap-2">
        <data className="font-mono text-2xl leading-none tracking-tight tabular-nums" value={numericValue}>
          {value}
        </data>
        <TrendBadge value={trend} trend={trendDirection} />
      </div>
    </article>
  );
}
