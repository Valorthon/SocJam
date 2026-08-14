import assert from "node:assert/strict";

import {
  getDraftComposerHref,
  getLatestDraftId,
  shouldOfferDraftResume,
} from "../src/lib/posts/draft-resume";

const draft = {
  id: "draft-newer",
  status: "DRAFT" as const,
  updatedAt: "2026-01-01T02:00:00.000Z",
};

assert.equal(
  getLatestDraftId([
    { id: "published", status: "PUBLISHED", updatedAt: "2026-01-01T03:00:00.000Z" },
    { id: "draft-older", status: "DRAFT", updatedAt: "2026-01-01T01:00:00.000Z" },
    draft,
  ]),
  draft.id,
  "the resume prompt selects the most recently updated server draft",
);
assert.equal(getLatestDraftId([]), null);
assert.equal(shouldOfferDraftResume(false, false, draft.id), true);
assert.equal(
  shouldOfferDraftResume(false, true, "a-newly-saved-draft"),
  false,
  "starting a new draft suppresses the prompt for the rest of the session",
);
assert.equal(shouldOfferDraftResume(true, false, draft.id), false);
assert.equal(getDraftComposerHref(draft), "/compose?id=draft-newer");
assert.equal(
  getDraftComposerHref({ id: "published", status: "PUBLISHED" }),
  null,
  "only draft rows navigate to the composer",
);

console.log("Draft resume tests passed.");
