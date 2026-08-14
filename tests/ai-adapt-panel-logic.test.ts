import assert from "node:assert/strict";

import {
  getAiAdaptationTargets,
  getEditedAiRegenerationCount,
  getQuotaUnavailableMessage,
  getRequestedAiGenerationCount,
} from "../src/components/features/composer/aiAdaptPanelLogic";
import type { ComposerVariant } from "../src/stores/composerStore";

function variant(
  accountId: string,
  platform: ComposerVariant["platform"],
  isManuallyEdited = false,
): ComposerVariant {
  return {
    accountId,
    platform,
    adaptedText: `${platform} draft`,
    isManuallyEdited,
    isAiGenerated: false,
  };
}

const variants = [
  variant("account-x", "X", true),
  variant("account-linkedin", "LINKEDIN"),
];

assert.equal(getRequestedAiGenerationCount([], true), 0);
assert.equal(getRequestedAiGenerationCount(variants, true), 1);
assert.equal(getRequestedAiGenerationCount(variants, false), 2);
assert.equal(
  getQuotaUnavailableMessage({ quotaReached: false, sharedCaption: true }),
  "There are not enough AI adaptations remaining for a shared caption.",
);
assert.equal(
  getQuotaUnavailableMessage({ quotaReached: false, sharedCaption: false }),
  "There are not enough AI adaptations remaining for the selected platforms.",
);
assert.equal(
  getQuotaUnavailableMessage({ quotaReached: true, sharedCaption: true }),
  "Daily AI adaptation limit reached. Try again later.",
);

assert.deepEqual(
  getAiAdaptationTargets({
    variants,
    requestedVariant: variants[0],
    sharedCaption: true,
  }).map((target) => target.accountId),
  ["account-x", "account-linkedin"],
);

assert.deepEqual(
  getAiAdaptationTargets({
    variants,
    requestedVariant: variants[0],
    sharedCaption: false,
  }).map((target) => target.accountId),
  ["account-x"],
);

assert.equal(getEditedAiRegenerationCount(variants), 1);

console.log("AI adapt panel logic tests passed.");
