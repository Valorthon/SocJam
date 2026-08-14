import type { ComposerVariant } from "@/stores/composerStore";

interface AiAdaptationTargetInput {
  variants: ComposerVariant[];
  requestedVariant: ComposerVariant;
  sharedCaption: boolean;
}

export function getRequestedAiGenerationCount(
  variants: ComposerVariant[],
  sharedCaption: boolean,
): number {
  if (variants.length === 0) {
    return 0;
  }

  if (sharedCaption) {
    return 1;
  }

  return new Set(variants.map((variant) => variant.platform)).size;
}

export function getAiAdaptationTargets({
  variants,
  requestedVariant,
  sharedCaption,
}: AiAdaptationTargetInput): ComposerVariant[] {
  return sharedCaption ? variants : [requestedVariant];
}

export function getEditedAiRegenerationCount(
  variants: ComposerVariant[],
): number {
  return variants.filter((variant) => variant.isManuallyEdited).length;
}

export function getQuotaUnavailableMessage({
  quotaReached,
  sharedCaption,
}: {
  quotaReached: boolean;
  sharedCaption: boolean;
}): string {
  if (quotaReached) {
    return "Daily AI adaptation limit reached. Try again later.";
  }

  return sharedCaption
    ? "There are not enough AI adaptations remaining for a shared caption."
    : "There are not enough AI adaptations remaining for the selected platforms.";
}
