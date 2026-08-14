import assert from "node:assert/strict";
import type { PostDetailDto } from "../src/types";

const xAccount = { id: "account-x", platform: "X" as const };
const linkedInAccount = { id: "account-linkedin", platform: "LINKEDIN" as const };

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: () => {
      throw new Error("Composer state must not read localStorage.");
    },
    setItem: () => {
      throw new Error("Composer state must not write localStorage.");
    },
    removeItem: () => {
      throw new Error("Composer state must not clear localStorage.");
    },
  },
});

const loadedDraft: PostDetailDto = {
  id: "post-1",
  idempotencyKey: "123e4567-e89b-12d3-a456-426614174012",
  baseText: "A saved server draft",
  status: "DRAFT",
  scheduledAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T01:00:00.000Z",
  targets: [
    {
      id: "target-1",
      accountId: xAccount.id,
      platform: "X",
      adaptedText: "A saved server draft",
      status: "DRAFT",
      scheduledAt: null,
      publishedAt: null,
      publishedUrl: null,
      error: null,
      attempts: 0,
      account: {
        id: xAccount.id,
        platform: "X",
        handle: "@omnipost",
        status: "ACTIVE",
        scheduledTargetCount: 0,
      },
    },
  ],
  media: [
    {
      id: "media-1",
      url: "https://example.com/image.jpg",
      type: "IMAGE",
      sizeBytes: 1024,
      width: 1200,
      height: 800,
      order: 0,
    },
  ],
};

async function run(): Promise<void> {
  const { requiresAiRegenerationConfirmation, useComposerStore } =
    await import("../src/stores/composerStore");
  const initialKey = useComposerStore.getState().idempotencyKey;
  useComposerStore.getState().beginNewDraft();

  assert.match(useComposerStore.getState().idempotencyKey, /^[0-9a-f-]{36}$/i);
  assert.notEqual(useComposerStore.getState().idempotencyKey, initialKey);
  const draftKey = useComposerStore.getState().idempotencyKey;

  useComposerStore.getState().setBaseText("OmniPost is ready to publish.");
  useComposerStore.getState().selectAccount(xAccount);
  useComposerStore.getState().selectAccount(linkedInAccount);

  assert.equal(
    useComposerStore.getState().idempotencyKey,
    draftKey,
    "editing a draft must preserve the idempotency key used for publish retries",
  );

  assert.deepEqual(useComposerStore.getState().selectedAccountIds, [
    xAccount.id,
    linkedInAccount.id,
  ]);
  assert.equal(
    useComposerStore.getState().variants[xAccount.id]?.adaptedText,
    "OmniPost is ready to publish.",
  );

  useComposerStore.getState().setBaseText("OmniPost is ready for every channel.");
  assert.equal(
    useComposerStore.getState().variants[xAccount.id]?.adaptedText,
    "OmniPost is ready for every channel.",
  );

  useComposerStore.getState().setVariantText(xAccount.id, "A concise X post.");
  useComposerStore.getState().setBaseText("OmniPost ships another update.");

  assert.deepEqual(useComposerStore.getState().variants[xAccount.id], {
    accountId: xAccount.id,
    platform: "X",
    adaptedText: "A concise X post.",
    isManuallyEdited: true,
    isAiGenerated: false,
  });
  assert.equal(
    useComposerStore.getState().variants[linkedInAccount.id]?.adaptedText,
    "OmniPost ships another update.",
  );

  useComposerStore
    .getState()
    .setAiVariant(linkedInAccount.id, "An AI-adapted LinkedIn post.");
  assert.deepEqual(useComposerStore.getState().variants[linkedInAccount.id], {
    accountId: linkedInAccount.id,
    platform: "LINKEDIN",
    adaptedText: "An AI-adapted LinkedIn post.",
    isManuallyEdited: false,
    isAiGenerated: true,
  });
  assert.equal(
    requiresAiRegenerationConfirmation(
      useComposerStore.getState().variants[linkedInAccount.id]!,
    ),
    false,
  );

  useComposerStore.getState().setBaseText("A new base draft.");
  assert.deepEqual(useComposerStore.getState().variants[linkedInAccount.id], {
    accountId: linkedInAccount.id,
    platform: "LINKEDIN",
    adaptedText: "A new base draft.",
    isManuallyEdited: false,
    isAiGenerated: false,
  });
  assert.equal(
    requiresAiRegenerationConfirmation(
      useComposerStore.getState().variants[xAccount.id]!,
    ),
    true,
  );

  useComposerStore.getState().deselectAccount(xAccount.id);
  assert.deepEqual(useComposerStore.getState().selectedAccountIds, [
    linkedInAccount.id,
  ]);
  assert.equal(useComposerStore.getState().variants[xAccount.id], undefined);
  assert.equal(
    useComposerStore.getState().idempotencyKey,
    draftKey,
    "the idempotency key must remain reusable until a new draft begins",
  );

  assert.equal(useComposerStore.getState().loadDraft(loadedDraft), true);
  assert.equal(
    useComposerStore.getState().idempotencyKey,
    loadedDraft.idempotencyKey,
    "loading a server draft must preserve its idempotency key",
  );
  assert.equal(useComposerStore.getState().baseText, loadedDraft.baseText);
  assert.deepEqual(useComposerStore.getState().selectedAccountIds, [xAccount.id]);
  assert.deepEqual(useComposerStore.getState().media, [
    {
      id: "media-1",
      url: "https://example.com/image.jpg",
      type: "IMAGE",
      sizeBytes: 1024,
      width: 1200,
      height: 800,
    },
  ]);

  assert.equal(
    useComposerStore.getState().loadDraft({
      ...loadedDraft,
      status: "PUBLISHED",
    }),
    false,
    "non-draft posts cannot be loaded into the composer",
  );

  console.log("Composer store tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
