import { RefreshCw } from "lucide-react";

import { MetricsCard } from "@/components/features/analytics/MetricsCard";
import {
  PostMetricsTable,
  type DemoPostMetric,
} from "@/components/features/analytics/PostMetricsTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const DEMO_METRICS = [
  { label: "Posts this month", value: "142", numericValue: 142, trend: "+12%", trendDirection: "up" },
  { label: "Total impressions", value: "1.2M", numericValue: 1200000, trend: "-4%", trendDirection: "down" },
  { label: "Avg. engagement", value: "4.8%", numericValue: 4.8, trend: "+0.2%", trendDirection: "up" },
  { label: "Link clicks", value: "8,405", numericValue: 8405, trend: "+22%", trendDirection: "up" },
  { label: "Conversion rate", value: "2.1%", numericValue: 2.1, trend: "—", trendDirection: "neutral", isStale: true },
] as const;

const DEMO_POST_METRICS: DemoPostMetric[] = [
  {
    id: "q3-roadmap-x",
    excerpt: "Announcing our new Q3 roadmap and the product improvements ahead.",
    platform: "X",
    impressions: 45210,
    likes: 1204,
    engagement: 342,
    engagementLabel: "Retweets",
    lastSynced: "Today, 14:32",
    isPublished: true,
  },
  {
    id: "design-sync-instagram",
    excerpt: "Behind the scenes at the design sync: the small details that shape the product.",
    platform: "INSTAGRAM",
    impressions: 82100,
    likes: 8450,
    engagement: 112,
    engagementLabel: "Comments",
    lastSynced: "Today, 14:28",
    isPublished: true,
  },
  {
    id: "hiring-linkedin",
    excerpt: "We are hiring for five open engineering roles across our product teams.",
    platform: "LINKEDIN",
    impressions: 15400,
    likes: 420,
    engagement: 85,
    engagementLabel: "Shares",
    lastSynced: "Today, 13:55",
    isPublished: true,
  },
  {
    id: "deploy-tiktok",
    excerpt: "Quick tip: automate your morning deploys and give your team back time to build.",
    platform: "TIKTOK",
    lastSynced: "Today, 12:10",
    isStale: true,
    isPublished: false,
  },
];

export default function AnalyticsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl pb-8">
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Performance overview</h2>
            <Badge variant="outline" className="border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Demo data
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Last 30 days compared with the previous period.</p>
        </div>
        <div className="flex items-center gap-3">
          <span id="analytics-refresh-note" className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            Next refresh in 4:12
          </span>
          <Button aria-describedby="analytics-refresh-note" variant="outline" size="sm" disabled>
            <RefreshCw className="size-3.5" />
            Refresh metrics
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Performance metrics">
        {DEMO_METRICS.map((metric) => (
          <MetricsCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="mt-8" aria-labelledby="per-platform-metrics">
        <div className="mb-4">
          <div className="flex items-center justify-between gap-4 pb-2">
          <div className="flex items-center gap-2">
            <h3 id="per-platform-metrics" className="font-mono text-[11px] font-medium uppercase tracking-widest">
              Per-platform metrics
            </h3>
            <Badge variant="outline" className="border-border bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Demo data
            </Badge>
          </div>
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">Static preview</span>
          </div>
          <Separator />
        </div>
        <PostMetricsTable rows={DEMO_POST_METRICS} />
      </section>
    </div>
  );
}
