"use client";

import { CalendarClock, LoaderCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PublishFooterProps {
  selectedCount: number;
  isValid: boolean;
  isPublishing: boolean;
  isScheduling: boolean;
  isUploading: boolean;
  isSavingDraft: boolean;
  draftSaveError: string | null;
  publishError: string | null;
  scheduleError: string | null;
  onInvalidAttempt: () => void;
  onPublish: () => void;
  onSchedule: () => void;
}

export function PublishFooter({
  selectedCount,
  isValid,
  isPublishing,
  isScheduling,
  isUploading,
  isSavingDraft,
  draftSaveError,
  publishError,
  scheduleError,
  onInvalidAttempt,
  onPublish,
  onSchedule,
}: PublishFooterProps) {
  const hasSelectedPlatforms = selectedCount > 0;
  const canPublish = hasSelectedPlatforms && isValid && !isUploading;

  return (
    <footer className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {isSavingDraft ? "Saving draft…" : "Drafts save automatically"}
          </p>
          {draftSaveError ? (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {draftSaveError}
            </p>
          ) : null}
          {!hasSelectedPlatforms ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Select at least one platform to continue.
            </p>
          ) : null}
          {hasSelectedPlatforms && !isValid ? (
            <div className="mt-0.5 flex items-center gap-2 text-xs text-destructive">
              <p>
                Fix the highlighted platform variants to continue.
              </p>
              <button
                type="button"
                onClick={onInvalidAttempt}
                className="underline underline-offset-2 hover:text-destructive/80"
              >
                Review errors
              </button>
            </div>
          ) : null}
          {isUploading ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Media upload in progress.
            </p>
          ) : null}
          {publishError ? (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {publishError}
            </p>
          ) : null}
          {scheduleError ? (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {scheduleError}
            </p>
          ) : null}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            className="flex-1 sm:flex-none"
            disabled={!canPublish || isPublishing || isScheduling}
            onClick={() => {
              if (!isValid || selectedCount === 0) {
                onInvalidAttempt();
                return;
              }
              onSchedule();
            }}
            title={
              canPublish
                ? "Schedule this post"
                : isUploading
                  ? "Wait for the media upload to finish"
                  : hasSelectedPlatforms
                    ? "Fix validation errors before scheduling"
                    : "Select at least one platform first"
            }
          >
            {isScheduling ? (
              <LoaderCircle className="mr-2 animate-spin" />
            ) : (
              <CalendarClock className="mr-2" />
            )}
            {isScheduling ? "Scheduling…" : "Schedule"}
          </Button>
          <Button
            type="button"
            className="flex-1 sm:flex-none"
            disabled={!canPublish || isPublishing}
            onClick={onPublish}
            title={
              canPublish
                ? "Publish this post now"
                : isUploading
                  ? "Wait for the media upload to finish"
                : hasSelectedPlatforms
                  ? "Fix validation errors before publishing"
                  : "Select at least one platform first"
            }
          >
            {isPublishing ? (
              <LoaderCircle className="mr-2 animate-spin" />
            ) : (
              <Send className="mr-2" />
            )}
            {isPublishing ? "Publishing…" : "Publish now"}
          </Button>
        </div>
      </div>
    </footer>
  );
}
