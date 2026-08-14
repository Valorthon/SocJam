"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  useAccounts,
  usePost,
  usePosts,
  usePublishPost,
  useSaveDraft,
} from "@/lib/api";
import {
  getLatestDraftId,
  shouldOfferDraftResume,
} from "@/lib/posts/draft-resume";
import { validatePost } from "@/lib/platforms/constraints";
import type { SaveDraftInput } from "@/lib/validations/post";
import { useComposerStore } from "@/stores/composerStore";

import { AiAdaptPanel } from "./AiAdaptPanel";
import { BaseTextArea } from "./BaseTextArea";
import { ContinueEditingModal } from "./ContinueEditingModal";
import { MediaUploader } from "./MediaUploader";
import { PlatformSelector } from "./PlatformSelector";
import { PlatformVariantCard } from "./PlatformVariantCard";
import { PublishFooter } from "./PublishFooter";
import { Skeleton } from "@/components/ui/skeleton";

export function Composer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get("id");
  const hasRequestedDraft = Boolean(requestedDraftId);
  const { data: accounts = [], isLoading, isError } = useAccounts();
  const { data: posts = [] } = usePosts();
  const requestedDraft = usePost(requestedDraftId);
  const latestDraftId = useMemo(() => getLatestDraftId(posts), [posts]);
  const recentDraft = usePost(hasRequestedDraft ? null : latestDraftId);
  const saveDraft = useSaveDraft();
  const publishPost = usePublishPost();
  const [publishError, setPublishError] = useState<string | null>(null);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [isPublishSubmitted, setIsPublishSubmitted] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);
  const [isContinueEditingOpen, setIsContinueEditingOpen] = useState(false);
  const [hasDismissedResumePrompt, setHasDismissedResumePrompt] =
    useState(false);
  const publishRequestedRef = useRef(false);
  const draftSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const saveDraftSnapshotRef = useRef<() => Promise<unknown>>(
    () => Promise.resolve(),
  );
  const skipDraftSaveOnUnmountRef = useRef(false);
  const baseText = useComposerStore((state) => state.baseText);
  const selectedAccountIds = useComposerStore(
    (state) => state.selectedAccountIds,
  );
  const setBaseText = useComposerStore((state) => state.setBaseText);
  const variants = useComposerStore((state) => state.variants);
  const media = useComposerStore((state) => state.media);
  const tone = useComposerStore((state) => state.tone);
  const idempotencyKey = useComposerStore((state) => state.idempotencyKey);
  const selectAccount = useComposerStore((state) => state.selectAccount);
  const deselectAccount = useComposerStore((state) => state.deselectAccount);
  const setVariantText = useComposerStore((state) => state.setVariantText);
  const setAiVariant = useComposerStore((state) => state.setAiVariant);
  const setMedia = useComposerStore((state) => state.setMedia);
  const setTone = useComposerStore((state) => state.setTone);
  const beginNewDraft = useComposerStore((state) => state.beginNewDraft);
  const loadDraft = useComposerStore((state) => state.loadDraft);
  const { selectedVariants, validations, variantsAreValid, firstInvalidAccountId } =
    useMemo(() => {
      const selectedVariants = selectedAccountIds.flatMap((accountId) => {
        const variant = variants[accountId];
        return variant ? [variant] : [];
      });
      const validations = new Map(
        selectedVariants.map((variant) => [
          variant.accountId,
          validatePost(variant.platform, variant.adaptedText, media),
        ]),
      );
      const firstInvalidAccountId = selectedVariants.find(
        (variant) => !validations.get(variant.accountId)?.valid,
      )?.accountId;

      return {
        selectedVariants,
        validations,
        variantsAreValid: selectedVariants.every(
          (variant) => validations.get(variant.accountId)?.valid,
        ),
        firstInvalidAccountId,
      };
    }, [media, selectedAccountIds, variants]);
  const scrollToFirstInvalidVariant = useCallback(() => {
    if (!firstInvalidAccountId) {
      return;
    }

    const card = document.getElementById(`variant-${firstInvalidAccountId}`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.querySelector<HTMLTextAreaElement>("textarea")?.focus({
      preventScroll: true,
    });
  }, [firstInvalidAccountId]);
  const hasDraftContent =
    baseText.trim().length > 0 || selectedVariants.length > 0 || media.length > 0;
  const createDraftInput = useCallback(
    (): SaveDraftInput => ({
      idempotencyKey,
      baseText,
      targets: selectedVariants.map((variant) => ({
        accountId: variant.accountId,
        adaptedText: variant.adaptedText,
      })),
      media: media.map((asset, index) => ({
        url: asset.url,
        type: asset.type,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        width: asset.width ?? null,
        height: asset.height ?? null,
        order: index,
      })),
    }),
    [baseText, idempotencyKey, media, selectedVariants],
  );
  const draftSnapshot = useMemo(
    () => (hasDraftContent ? JSON.stringify(createDraftInput()) : null),
    [createDraftInput, hasDraftContent],
  );
  const saveDraftSnapshot = useCallback(() => {
    if (!hasDraftContent) {
      return Promise.resolve(null);
    }

    const input = createDraftInput();
    const save = () => saveDraft.mutateAsync(input);
    const result = draftSaveQueueRef.current.then(save, save);
    draftSaveQueueRef.current = result.catch(() => undefined);

    return result.then(
      (post) => {
        setDraftSaveError(null);
        return post;
      },
      (error: unknown) => {
        setDraftSaveError("We couldn’t save your draft. Please try again.");
        throw error;
      },
    );
  }, [createDraftInput, hasDraftContent, saveDraft]);

  saveDraftSnapshotRef.current = saveDraftSnapshot;

  useEffect(() => {
    beginNewDraft();
    setDraftLoadError(null);
    setIsContinueEditingOpen(false);
    setHasDismissedResumePrompt(false);
  }, [beginNewDraft, requestedDraftId]);

  useEffect(() => {
    if (!hasRequestedDraft || requestedDraft.isPending) {
      return;
    }

    if (requestedDraft.data && loadDraft(requestedDraft.data)) {
      return;
    }

    beginNewDraft();
    setDraftLoadError(
      "We couldn’t load that draft. You can start a new post instead.",
    );
  }, [
    beginNewDraft,
    hasRequestedDraft,
    loadDraft,
    requestedDraft.data,
    requestedDraft.isPending,
  ]);

  useEffect(() => {
    if (
      !shouldOfferDraftResume(
        hasRequestedDraft,
        hasDismissedResumePrompt,
        recentDraft.data?.id,
      )
    ) {
      return;
    }

    setIsContinueEditingOpen(true);
  }, [hasDismissedResumePrompt, hasRequestedDraft, recentDraft.data?.id]);

  useEffect(() => {
    if (!isContinueEditingOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setIsContinueEditingOpen(false);
      setHasDismissedResumePrompt(true);
    }, 7000);

    return () => window.clearTimeout(timeout);
  }, [isContinueEditingOpen, recentDraft.data?.id]);

  const dismissRecentDraft = useCallback(() => {
    setIsContinueEditingOpen(false);
    setHasDismissedResumePrompt(true);
  }, []);

  const continueRecentDraft = useCallback(() => {
    if (!recentDraft.data || !loadDraft(recentDraft.data)) {
      setDraftLoadError(
        "We couldn’t load that draft. You can start a new post instead.",
      );
    }

    dismissRecentDraft();
  }, [dismissRecentDraft, loadDraft, recentDraft.data]);

  useEffect(() => {
    if (!draftSnapshot) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void saveDraftSnapshotRef.current().catch(() => undefined);
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [draftSnapshot]);

  useEffect(
    () => () => {
      if (!skipDraftSaveOnUnmountRef.current) {
        void saveDraftSnapshotRef.current().catch(() => undefined);
      }
    },
    [],
  );

  const isPublishing = isPublishSubmitted || publishPost.isPending;
  const handlePublish = useCallback(async () => {
    if (publishRequestedRef.current) {
      return;
    }

    if (!variantsAreValid || selectedVariants.length === 0) {
      scrollToFirstInvalidVariant();
      return;
    }

    setPublishError(null);
    publishRequestedRef.current = true;
    setIsPublishSubmitted(true);

    try {
      const post = await saveDraftSnapshot();
      if (!post) {
        throw new Error("A post cannot be published without draft content.");
      }
      await publishPost.mutateAsync({ postId: post.id });

      skipDraftSaveOnUnmountRef.current = true;
      beginNewDraft();
      router.push("/dashboard");
    } catch {
      publishRequestedRef.current = false;
      setIsPublishSubmitted(false);
      setPublishError(
        "We couldn’t publish this post. Please review your draft and try again.",
      );
    }
  }, [
    beginNewDraft,
    publishPost,
    router,
    saveDraftSnapshot,
    scrollToFirstInvalidVariant,
    selectedVariants,
    variantsAreValid,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col pb-4">
      <div className="space-y-6">
        {draftLoadError ? (
          <section
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4"
            role="alert"
          >
            <p className="text-sm text-foreground">{draftLoadError}</p>
          </section>
        ) : null}
        {isLoading ? (
          <section aria-label="Loading accounts" className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-36" />
            </div>
          </section>
        ) : isError ? (
          <section
            aria-labelledby="platform-load-error-heading"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-4"
          >
            <h2
              id="platform-load-error-heading"
              className="font-medium text-foreground"
            >
              Unable to load connected accounts
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Refresh the page and try again before publishing.
            </p>
          </section>
        ) : (
          <PlatformSelector
            accounts={accounts}
            selectedAccountIds={selectedAccountIds}
            onSelect={selectAccount}
            onDeselect={deselectAccount}
          />
        )}

        <BaseTextArea value={baseText} onChange={setBaseText} />

        <MediaUploader
          media={media}
          onChange={setMedia}
          onUploadingChange={setIsUploadingMedia}
        />

        <AiAdaptPanel
          baseText={baseText}
          variants={selectedVariants}
          media={media}
          tone={tone}
          onToneChange={setTone}
          onGenerated={setAiVariant}
        >
          {({ generatingAccountIds, sharedCaption, onRegenerate }) =>
            selectedVariants.length > 0 ? (
              <section className="space-y-4" aria-label="Platform variations">
                {selectedVariants.map((variant) => (
                  <PlatformVariantCard
                    key={variant.accountId}
                    variant={variant}
                    media={media}
                    errors={validations.get(variant.accountId)?.errors ?? []}
                    isGenerating={generatingAccountIds.has(variant.accountId)}
                    usesSharedCaption={sharedCaption}
                    onChange={(adaptedText) =>
                      setVariantText(variant.accountId, adaptedText)
                    }
                    onRegenerate={() => onRegenerate(variant)}
                  />
                ))}
              </section>
            ) : (
              <section className="rounded-lg border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
                Select a connected platform to create a tailored post variation.
              </section>
            )
          }
        </AiAdaptPanel>
      </div>

      <PublishFooter
        selectedCount={selectedAccountIds.length}
        isValid={variantsAreValid}
        isPublishing={isPublishing}
        isUploading={isUploadingMedia}
        isSavingDraft={saveDraft.isPending}
        draftSaveError={draftSaveError}
        publishError={publishError}
        onInvalidAttempt={scrollToFirstInvalidVariant}
        onPublish={handlePublish}
      />

      <ContinueEditingModal
        draft={recentDraft.data ?? null}
        open={isContinueEditingOpen}
        onContinue={continueRecentDraft}
        onStartNew={dismissRecentDraft}
      />
    </div>
  );
}
