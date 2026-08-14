"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, useAiAdaptationQuota, useAdaptPost } from "@/lib/api";
import { requiresAiRegenerationConfirmation } from "@/stores/composerStore";
import type {
  ComposerMedia,
  ComposerTone,
  ComposerVariant,
} from "@/stores/composerStore";

import {
  getAiAdaptationTargets,
  getEditedAiRegenerationCount,
  getQuotaUnavailableMessage,
  getRequestedAiGenerationCount,
} from "./aiAdaptPanelLogic";
import { ToneSelector } from "./ToneSelector";

interface AiAdaptPanelProps {
  baseText: string;
  variants: ComposerVariant[];
  media: ComposerMedia[];
  tone: ComposerTone;
  onToneChange: (tone: ComposerTone) => void;
  onGenerated: (accountId: string, adaptedText: string) => void;
  children: (controls: AiAdaptPanelControls) => ReactNode;
}

export interface AiAdaptPanelControls {
  generatingAccountIds: ReadonlySet<string>;
  sharedCaption: boolean;
  onRegenerate: (variant: ComposerVariant) => void;
}

export function AiAdaptPanel({
  baseText,
  variants,
  media,
  tone,
  onToneChange,
  onGenerated,
  children,
}: AiAdaptPanelProps) {
  const adaptPost = useAdaptPost();
  const aiQuota = useAiAdaptationQuota();
  const queryClient = useQueryClient();
  const adaptingRef = useRef(false);
  const [sharedCaption, setSharedCaption] = useState(false);
  const [pendingRegenerationTargets, setPendingRegenerationTargets] =
    useState<ComposerVariant[] | null>(null);
  const [generatingAccountIds, setGeneratingAccountIds] = useState<
    ReadonlySet<string>
  >(new Set());
  const [adaptationError, setAdaptationError] = useState<string | null>(null);
  const quota = aiQuota.data?.quota;
  const quotaReached = quota?.remaining === 0;
  const canUseSharedCaption = variants.length > 1;
  const effectiveSharedCaption = sharedCaption && canUseSharedCaption;
  const requestedGenerationCount = getRequestedAiGenerationCount(
    variants,
    effectiveSharedCaption,
  );
  const pendingEditedCount = pendingRegenerationTargets
    ? getEditedAiRegenerationCount(pendingRegenerationTargets)
    : 0;
  const quotaUnavailableMessage = getQuotaUnavailableMessage({
    quotaReached,
    sharedCaption: effectiveSharedCaption,
  });
  const quotaCannotAdapt =
    quota !== undefined && quota.remaining < requestedGenerationCount;
  const canAdapt =
    baseText.trim().length > 0 &&
    variants.length > 0 &&
    !adaptPost.isPending &&
    !adaptingRef.current &&
    !aiQuota.isLoading &&
    !aiQuota.isError &&
    !quotaCannotAdapt;

  useEffect(() => {
    if (!canUseSharedCaption && sharedCaption) {
      setSharedCaption(false);
    }
  }, [canUseSharedCaption, sharedCaption]);

  async function adaptVariants(variantsToAdapt: ComposerVariant[]) {
    if (
      !baseText.trim() ||
      variantsToAdapt.length === 0 ||
      adaptingRef.current
    ) {
      return;
    }

    adaptingRef.current = true;
    setAdaptationError(null);
    setGeneratingAccountIds(
      new Set(variantsToAdapt.map((variant) => variant.accountId)),
    );

    try {
      const result = await adaptPost.mutateAsync({
        baseText,
        platforms: Array.from(
          new Set(variantsToAdapt.map((variant) => variant.platform)),
        ),
        tone,
        media: {
          hasImages: media.some((item) => item.type === "IMAGE"),
          hasVideo: media.some((item) => item.type === "VIDEO"),
        },
        sharedCaption: effectiveSharedCaption,
      });
      queryClient.setQueryData(["ai", "adaptation-quota"], {
        quota: result.quota,
      });

      const generatedByPlatform = new Map(
        result.variants.map((variant) => [variant.platform, variant]),
      );
      const hasCompleteResponse = variantsToAdapt.every((variant) =>
        generatedByPlatform.has(variant.platform),
      );

      if (!hasCompleteResponse) {
        throw new Error("Incomplete AI adaptation response");
      }

      for (const variant of variantsToAdapt) {
        const generatedVariant = generatedByPlatform.get(variant.platform);
        if (!generatedVariant) {
          continue;
        }

        onGenerated(variant.accountId, generatedVariant.text);
      }
    } catch (error) {
      setAdaptationError(
        error instanceof ApiError && error.status === 429
          ? error.message
          : "AI adaptation failed. Try again.",
      );
      void aiQuota.refetch();
    } finally {
      adaptingRef.current = false;
      setGeneratingAccountIds(new Set());
    }
  }

  function requestRegeneration(variant: ComposerVariant) {
    if (adaptPost.isPending || adaptingRef.current || quotaReached) {
      return;
    }

    const targets = getAiAdaptationTargets({
      variants,
      requestedVariant: variant,
      sharedCaption: effectiveSharedCaption,
    });
    if (targets.some(requiresAiRegenerationConfirmation)) {
      setPendingRegenerationTargets(targets);
      return;
    }

    void adaptVariants(targets);
  }

  function confirmRegeneration() {
    if (!pendingRegenerationTargets) {
      return;
    }

    const targets = pendingRegenerationTargets;
    setPendingRegenerationTargets(null);
    void adaptVariants(targets);
  }

  return (
    <>
      <section
        aria-labelledby="ai-adaptation-heading"
        className="rounded-lg border border-border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="ai-adaptation-heading"
              className="text-sm font-medium text-foreground"
            >
              AI adaptation
            </h2>
            <p
              id="ai-adaptation-help"
              className="mt-1 text-xs text-muted-foreground"
            >
              Generate platform-native drafts for review. AI suggestions are
              never published automatically.
            </p>
          </div>
          <ToneSelector value={tone} onChange={onToneChange} />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {variants.length > 0
              ? effectiveSharedCaption
                ? `Generate one suggestion for ${variants.length} selected ${variants.length === 1 ? "platform" : "platforms"}.`
                : `Generate suggestions for ${variants.length} selected ${variants.length === 1 ? "platform" : "platforms"}.`
              : "Select a platform to generate a suggestion."}
          </p>
          <div className="w-full space-y-1 sm:w-auto sm:text-right">
            <Button
              type="button"
              onClick={() => void adaptVariants(variants)}
              disabled={!canAdapt}
              aria-describedby="ai-adaptation-help"
              title={
                quotaCannotAdapt
                  ? quotaUnavailableMessage
                  : undefined
              }
              className="w-full sm:w-auto"
            >
              {adaptPost.isPending ? (
                <LoaderCircle className="mr-2 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="mr-2" aria-hidden="true" />
              )}
              {adaptPost.isPending ? "Adapting with AI" : "Adapt with AI"}
            </Button>
            {quota ? (
              <p className="text-xs text-muted-foreground">
                {quota.remaining}/{quota.limit} today
              </p>
            ) : null}
          </div>
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-md border border-border bg-background/50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={sharedCaption}
            onChange={(event) => setSharedCaption(event.target.checked)}
            disabled={
              adaptPost.isPending ||
              adaptingRef.current ||
              !canUseSharedCaption
            }
            className="mt-0.5 size-4 rounded border-input text-primary accent-primary"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">
              {canUseSharedCaption
                ? "Same caption on all platforms"
                : "Shared caption available with multiple platforms"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {canUseSharedCaption
                ? "One AI draft, reviewed against each selected platform."
                : "Select at least two platforms to generate one shared caption."}
            </span>
          </span>
        </label>

        {quotaCannotAdapt ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            {quotaUnavailableMessage}
          </p>
        ) : null}

        {aiQuota.isError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            Unable to check AI availability. Refresh and try again.
          </p>
        ) : null}

        {adaptationError ? (
          <div
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            <span>{adaptationError}</span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => void adaptVariants(variants)}
              disabled={!canAdapt}
            >
              Retry
            </Button>
          </div>
        ) : null}
      </section>

      {children({
        generatingAccountIds,
        sharedCaption: effectiveSharedCaption,
        onRegenerate: requestRegeneration,
      })}

      <Dialog
        open={pendingRegenerationTargets !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRegenerationTargets(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace your edits?</DialogTitle>
            <DialogDescription>
              {pendingEditedCount > 1
                ? `Regenerating will replace edits in ${pendingEditedCount} captions with a new AI suggestion.`
                : "Regenerating this variant will replace the edits you made with a new AI suggestion."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingRegenerationTargets(null)}
            >
              Keep edits
            </Button>
            <Button type="button" onClick={confirmRegeneration}>
              Replace with AI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
