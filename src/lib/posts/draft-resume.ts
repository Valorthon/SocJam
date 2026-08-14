import type { PostListItemDto } from "@/types";

type DraftCandidate = Pick<PostListItemDto, "id" | "status" | "updatedAt">;

export function shouldOfferDraftResume(
  hasRequestedDraft: boolean,
  hasDismissedResumePrompt: boolean,
  latestDraftId: string | null | undefined,
): boolean {
  return (
    !hasRequestedDraft &&
    !hasDismissedResumePrompt &&
    Boolean(latestDraftId)
  );
}

export function getLatestDraftId(posts: readonly DraftCandidate[]): string | null {
  let latestDraft: DraftCandidate | null = null;

  for (const post of posts) {
    if (
      post.status === "DRAFT" &&
      (!latestDraft || post.updatedAt > latestDraft.updatedAt)
    ) {
      latestDraft = post;
    }
  }

  return latestDraft?.id ?? null;
}

export function getDraftComposerHref(
  post: Pick<PostListItemDto, "id" | "status">,
): string | null {
  return post.status === "DRAFT" ? `/compose?id=${post.id}` : null;
}
