"use client";

import { Bot, PencilLine, RefreshCw } from "lucide-react";

import { PlatformIcon } from "@/components/features/accounts/PlatformIcon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getConstraints,
  getMediaRequirementMessage,
  hasRequiredMedia,
  PLATFORM_ONBOARDING_DETAILS,
} from "@/lib/platforms/constraints";
import { cn } from "@/lib/utils";
import type { ComposerMedia, ComposerVariant } from "@/stores/composerStore";

interface PlatformVariantCardProps {
  variant: ComposerVariant;
  media: ComposerMedia[];
  errors: string[];
  isGenerating: boolean;
  usesSharedCaption: boolean;
  onChange: (value: string) => void;
  onRegenerate: () => void;
}

export function PlatformVariantCard({
  variant,
  media,
  errors,
  isGenerating,
  usesSharedCaption,
  onChange,
  onRegenerate,
}: PlatformVariantCardProps) {
  const constraints = getConstraints(variant.platform);
  const requirement = getMediaRequirementMessage(variant.platform);
  const hasRequiredPlatformMedia = hasRequiredMedia(variant.platform, media);
  const charactersRemaining = constraints.maxChars - variant.adaptedText.length;
  const isOverLimit = charactersRemaining < 0;
  const regenerateLabel = usesSharedCaption
    ? "Regenerate shared caption for all selected platforms with AI"
    : `Regenerate ${variant.platform} variant with AI`;

  return (
    <article
      id={`variant-${variant.accountId}`}
      className={cn(
        "scroll-mt-6 rounded-lg border bg-card p-4 sm:p-5",
        errors.length > 0 ? "border-destructive/70" : "border-border",
      )}
      aria-labelledby={`variant-heading-${variant.accountId}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <PlatformIcon platform={variant.platform} className="size-8 text-[10px]" />
          <div className="min-w-0">
            <h2
              id={`variant-heading-${variant.accountId}`}
              className="text-sm font-medium text-foreground"
            >
              {PLATFORM_ONBOARDING_DETAILS[variant.platform].name}
            </h2>
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Platform variant
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {variant.isAiGenerated ? (
            <Badge variant="secondary" className="gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              <Bot className="size-3" />
              AI
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={isGenerating}
            onClick={onRegenerate}
            title={regenerateLabel}
            aria-label={regenerateLabel}
          >
            <RefreshCw className={isGenerating ? "animate-spin" : undefined} />
          </Button>
        </div>
      </div>

      {isGenerating ? (
        <div
          className="mt-4 space-y-3"
          role="status"
          aria-label={`Generating ${variant.platform} variant`}
        >
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <span className="sr-only">Generating AI suggestion…</span>
        </div>
      ) : (
        <textarea
          value={variant.adaptedText}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${variant.platform} post text`}
          aria-describedby={`variant-count-${variant.accountId} variant-errors-${variant.accountId}`}
          aria-invalid={errors.length > 0}
          className="mt-4 min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={`Write your ${variant.platform} post...`}
        />
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span
          id={`variant-count-${variant.accountId}`}
          className={cn(
            "font-mono tabular-nums",
            isOverLimit ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {isOverLimit
            ? `${Math.abs(charactersRemaining)} over ${constraints.maxChars}`
            : `${variant.adaptedText.length} / ${constraints.maxChars}`}
        </span>
        {requirement ? (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              hasRequiredPlatformMedia
                ? "text-emerald-500"
                : "text-muted-foreground",
            )}
          >
            <PencilLine className="size-3" />
            {requirement}{hasRequiredPlatformMedia ? " ✓" : ""}
          </span>
        ) : null}
      </div>

      {errors.length > 0 ? (
        <ul
          id={`variant-errors-${variant.accountId}`}
          className="mt-3 space-y-1 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : (
        <p id={`variant-errors-${variant.accountId}`} className="sr-only">
          This platform variant is valid.
        </p>
      )}
    </article>
  );
}
