"use client";

import { create } from "zustand";

import type { Platform } from "@/lib/platforms/constraints";
import { COMPOSER_TONES } from "@/lib/validations/ai";
import type { PostDetailDto } from "@/types";

export type ComposerTone = (typeof COMPOSER_TONES)[number];

export { COMPOSER_TONES };

export interface ComposerMedia {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  sizeBytes: number;
  mimeType: string;
  width?: number | null;
  height?: number | null;
}

export interface ComposerVariant {
  accountId: string;
  platform: Platform;
  adaptedText: string;
  isManuallyEdited: boolean;
  isAiGenerated: boolean;
}

export interface ComposerAccountSelection {
  id: string;
  platform: Platform;
}

export function requiresAiRegenerationConfirmation(
  variant: ComposerVariant,
): boolean {
  return variant.isManuallyEdited;
}

interface ComposerDraftState {
  idempotencyKey: string;
  baseText: string;
  selectedAccountIds: string[];
  variants: Record<string, ComposerVariant>;
  media: ComposerMedia[];
  tone: ComposerTone;
  scheduledAt: string | null;
}

interface ComposerStore extends ComposerDraftState {
  beginNewDraft: () => void;
  loadDraft: (draft: PostDetailDto) => boolean;
  setBaseText: (baseText: string) => void;
  selectAccount: (account: ComposerAccountSelection) => void;
  deselectAccount: (accountId: string) => void;
  setVariantText: (accountId: string, adaptedText: string) => void;
  setAiVariant: (accountId: string, adaptedText: string) => void;
  setMedia: (media: ComposerMedia[]) => void;
  setTone: (tone: ComposerTone) => void;
  setScheduledAt: (scheduledAt: string | null) => void;
}

function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

function createInitialDraft(): ComposerDraftState {
  return {
    idempotencyKey: createIdempotencyKey(),
    baseText: "",
    selectedAccountIds: [],
    variants: {},
    media: [],
    tone: "professional",
    scheduledAt: null,
  };
}

export const useComposerStore = create<ComposerStore>()((set) => ({
  ...createInitialDraft(),
  beginNewDraft: () => set(createInitialDraft()),
  loadDraft: (draft) => {
    if (draft.status !== "DRAFT") {
      return false;
    }

    const variants: Record<string, ComposerVariant> = {};
    for (const target of draft.targets) {
      if (!target.accountId) {
        continue;
      }

      variants[target.accountId] = {
        accountId: target.accountId,
        platform: target.platform,
        adaptedText: target.adaptedText,
        isManuallyEdited: target.adaptedText !== draft.baseText,
        isAiGenerated: false,
      };
    }

    set({
      idempotencyKey: draft.idempotencyKey,
      baseText: draft.baseText,
      selectedAccountIds: Object.keys(variants),
      variants,
      media: draft.media.map((asset) => ({
        id: asset.id,
        url: asset.url,
        type: asset.type,
        sizeBytes: asset.sizeBytes,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
      })),
      tone: "professional",
      scheduledAt: draft.scheduledAt,
    });

    return true;
  },
      setBaseText: (baseText) =>
        set((state) => ({
          baseText,
          variants: Object.fromEntries(
            Object.entries(state.variants).map(([accountId, variant]) => [
              accountId,
              variant.isManuallyEdited
                ? variant
                : {
                    ...variant,
                    adaptedText: baseText,
                    isAiGenerated: false,
                  },
            ]),
          ),
        })),
      selectAccount: (account) =>
        set((state) => {
          if (state.selectedAccountIds.includes(account.id)) {
            return state;
          }

          return {
            selectedAccountIds: [...state.selectedAccountIds, account.id],
            variants: {
              ...state.variants,
              [account.id]: {
                accountId: account.id,
                platform: account.platform,
                adaptedText: state.baseText,
                isManuallyEdited: false,
                isAiGenerated: false,
              },
            },
          };
        }),
      deselectAccount: (accountId) =>
        set((state) => {
          const { [accountId]: _removedVariant, ...remainingVariants } =
            state.variants;

          return {
            selectedAccountIds: state.selectedAccountIds.filter(
              (id) => id !== accountId,
            ),
            variants: remainingVariants,
          };
        }),
      setVariantText: (accountId, adaptedText) =>
        set((state) => {
          const variant = state.variants[accountId];
          if (!variant) {
            return state;
          }

          return {
            variants: {
              ...state.variants,
              [accountId]: {
                ...variant,
                adaptedText,
                isManuallyEdited: true,
                isAiGenerated: false,
              },
            },
          };
        }),
      setAiVariant: (accountId, adaptedText) =>
        set((state) => {
          const variant = state.variants[accountId];
          if (!variant) {
            return state;
          }

          return {
            variants: {
              ...state.variants,
              [accountId]: {
                ...variant,
                adaptedText,
                isManuallyEdited: false,
                isAiGenerated: true,
              },
            },
          };
        }),
      setMedia: (media) => set({ media }),
  setTone: (tone) => set({ tone }),
  setScheduledAt: (scheduledAt) => set({ scheduledAt }),
}));
