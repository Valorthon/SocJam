import assert from "node:assert/strict";

import type { DraftCandidate } from "../src/lib/posts/draft-resume";
import {
  getDraftComposerHref,
  getLatestDraftId,
  isDraftEmpty,
  shouldOfferDraftResume,
} from "../src/lib/posts/draft-resume";

function draft(
  id: string,
  updatedAt: string,
  overrides: Partial<Pick<DraftCandidate, "baseText" | "targets">> = {},
): DraftCandidate {
  return {
    id,
    status: "DRAFT",
    baseText: overrides.baseText ?? "",
    targets: overrides.targets ?? [],
    updatedAt,
  };
}

const nonEmptyDraft = draft("draft-newer", "2026-01-01T02:00:00.000Z", {
  baseText: "Hello world",
});

assert.equal(
  getLatestDraftId([
    {
      id: "published",
      status: "PUBLISHED",
      baseText: "",
      targets: [],
      updatedAt: "2026-01-01T03:00:00.000Z",
    },
    draft("draft-older", "2026-01-01T01:00:00.000Z", { baseText: "Older" }),
    nonEmptyDraft,
  ]),
  nonEmptyDraft.id,
  "the resume prompt selects the most recently updated server draft",
);
assert.equal(getLatestDraftId([]), null);
assert.equal(
  getLatestDraftId([
    draft("empty-1", "2026-01-01T03:00:00.000Z"),
    draft("empty-2", "2026-01-01T02:00:00.000Z"),
  ]),
  null,
  "empty drafts do not trigger a resume offer",
);
assert.equal(
  getLatestDraftId([
    draft("empty-latest", "2026-01-01T03:00:00.000Z"),
    draft("non-empty-older", "2026-01-01T01:00:00.000Z", {
      baseText: "Still here",
    }),
  ]),
  "non-empty-older",
  "an empty latest draft is skipped in favor of an older non-empty draft",
);
assert.equal(
  getLatestDraftId([
    draft("targets-only", "2026-01-01T02:00:00.000Z", {
      targets: [
        {
          id: "target-1",
          accountId: "acc-1",
          platform: "LINKEDIN",
          status: "DRAFT",
          publishedUrl: null,
          error: null,
          account: null,
        },
      ],
    }),
  ]),
  "targets-only",
  "a draft with no text but selected platforms is considered non-empty",
);
assert.equal(isDraftEmpty(draft("empty", "2026-01-01T00:00:00.000Z")), true);
assert.equal(
  isDraftEmpty(
    draft("non-empty", "2026-01-01T00:00:00.000Z", { baseText: "x" }),
  ),
  false,
);
assert.equal(shouldOfferDraftResume(false, false, nonEmptyDraft.id), true);
assert.equal(
  shouldOfferDraftResume(false, true, "a-newly-saved-draft"),
  false,
  "starting a new draft suppresses the prompt for the rest of the session",
);
assert.equal(shouldOfferDraftResume(true, false, nonEmptyDraft.id), false);
assert.equal(
  getDraftComposerHref({ id: nonEmptyDraft.id, status: nonEmptyDraft.status }),
  `/compose?id=${nonEmptyDraft.id}`,
);
assert.equal(
  getDraftComposerHref({
    id: "published",
    status: "PUBLISHED",
  }),
  null,
  "only draft rows navigate to the composer",
);

console.log("Draft resume tests passed.");
