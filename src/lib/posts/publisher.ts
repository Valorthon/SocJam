import type { MediaAsset, PostStatus, SocialAccount, TargetStatus } from "@prisma/client";
import { getPlatformAdapter } from "@/lib/platforms/registry";
import type { Platform } from "@/lib/platforms/constraints";
import type { PublishResult, SocialPlatformAdapter } from "@/lib/platforms/types";
import { postWithRelationsInclude, type PostWithRelations } from "@/lib/posts";
import { derivePostStatus } from "@/lib/posts/status";

export { derivePostStatus } from "@/lib/posts/status";

const publishInclude = {
  targets: {
    include: { account: true },
    orderBy: { id: "asc" },
  },
  media: { orderBy: { order: "asc" } },
} as const;

type PublishablePost = {
  id: string;
  userId: string;
  idempotencyKey: string;
  targets: Array<{
    id: string;
    accountId: string | null;
    platform: Platform;
    adaptedText: string;
    status: TargetStatus;
    attempts: number;
    account: SocialAccount | null;
  }>;
  media: MediaAsset[];
};

export interface PublisherDependencies {
  claimPost: (postId: string, userId: string) => Promise<PublishablePost | null>;
  findPost: (postId: string, userId: string) => Promise<PublishablePost | null>;
  loadResult: (postId: string, userId: string) => Promise<PostWithRelations | null>;
  updatePostStatus: (postId: string, status: PostStatus) => Promise<void>;
  markTargetPublishing: (targetId: string) => Promise<void>;
  markTargetPublished: (targetId: string, publishedUrl: string, publishedAt: Date) => Promise<void>;
  markTargetFailed: (targetId: string, error: string) => Promise<void>;
  markAccountReconnectRequired: (accountId: string) => Promise<void>;
  getAdapter?: (platform: Platform) => SocialPlatformAdapter;
  now?: () => Date;
  publishableStatuses?: readonly TargetStatus[];
  skipMarkTargetPublishing?: boolean;
}

export function safePublishError(
  result: Extract<PublishResult, { ok: false }>,
  platform: Platform,
): string {
  if (result.authExpired) return `Reconnect your ${platform} account to publish this target.`;
  return result.error.trim().slice(0, 500) || "Unable to publish this target.";
}

export function createPublisher(dependencies: PublisherDependencies) {
  return async function publishPost(postId: string, userId: string): Promise<PostWithRelations | null> {
    const post = await dependencies.claimPost(postId, userId);
    if (!post) return dependencies.loadResult(postId, userId);

    const publishableStatuses = dependencies.publishableStatuses ?? ["DRAFT"];
    const pendingTargets = post.targets.filter((target) => publishableStatuses.includes(target.status));
    if (pendingTargets.length === 0) {
      await dependencies.updatePostStatus(post.id, derivePostStatus(post.targets));
      return dependencies.loadResult(post.id, userId);
    }

    await dependencies.updatePostStatus(post.id, "PUBLISHING");
    const getAdapter = dependencies.getAdapter ?? getPlatformAdapter;
    const now = dependencies.now ?? (() => new Date());

    for (const target of pendingTargets) {
      if (!dependencies.skipMarkTargetPublishing) {
        await dependencies.markTargetPublishing(target.id);
      }
      if (!target.account || !target.accountId) {
        await dependencies.markTargetFailed(
          target.id,
          `The ${target.platform} account was disconnected.`,
        );
        continue;
      }

      const adapter = getAdapter(target.platform);

      try {
        const auth = await adapter.checkAuth(target.account);
        if (!auth.active) {
          await dependencies.markAccountReconnectRequired(target.accountId);
          await dependencies.markTargetFailed(target.id, `Reconnect your ${target.platform} account to publish this target.`);
          continue;
        }

        const account = auth.account ?? target.account;

        const result = await adapter.publishPost({
          targetId: target.id,
          idempotencyKey: post.idempotencyKey,
          text: target.adaptedText,
          media: post.media,
          account,
        });

        if (result.ok) {
          await dependencies.markTargetPublished(target.id, result.publishedUrl, now());
        } else {
          if (result.authExpired) await dependencies.markAccountReconnectRequired(target.accountId);
          await dependencies.markTargetFailed(target.id, safePublishError(result, target.platform));
        }
      } catch (error) {
        console.error("Unable to publish target.", { postId: post.id, targetId: target.id, error });
        await dependencies.markTargetFailed(target.id, "Unable to publish this target.");
      }
    }

    const updated = await dependencies.findPost(post.id, userId);
    if (!updated) return null;
    await dependencies.updatePostStatus(post.id, derivePostStatus(updated.targets));
    return dependencies.loadResult(post.id, userId);
  };
}

export const publishPostForUser = createPublisher({
  claimPost: async (postId, userId) => {
    const { db } = await import("@/lib/db");
    return db.$transaction(async (transaction) => {
      const claim = await transaction.post.updateMany({
        where: { id: postId, userId, status: { in: ["DRAFT", "SCHEDULED"] } },
        data: { status: "PUBLISHING" },
      });
      if (claim.count === 0) return null;
      return transaction.post.findFirst({ where: { id: postId, userId }, include: publishInclude });
    });
  },
  findPost: async (postId, userId) => {
    const { db } = await import("@/lib/db");
    return db.post.findFirst({ where: { id: postId, userId }, include: publishInclude });
  },
  loadResult: async (postId, userId) => {
    const { db } = await import("@/lib/db");
    return db.post.findFirst({ where: { id: postId, userId }, include: postWithRelationsInclude });
  },
  updatePostStatus: async (postId, status) => { const { db } = await import("@/lib/db"); await db.post.update({ where: { id: postId }, data: { status } }); },
  markTargetPublishing: async (targetId) => { const { db } = await import("@/lib/db"); await db.postTarget.update({ where: { id: targetId }, data: { status: "PUBLISHING", attempts: { increment: 1 } } }); },
  markTargetPublished: async (targetId, publishedUrl, publishedAt) => { const { db } = await import("@/lib/db"); await db.postTarget.update({ where: { id: targetId }, data: { status: "PUBLISHED", publishedUrl, publishedAt, error: null } }); },
  markTargetFailed: async (targetId, error) => { const { db } = await import("@/lib/db"); await db.postTarget.update({ where: { id: targetId }, data: { status: "FAILED", error } }); },
  markAccountReconnectRequired: async (accountId) => { const { db } = await import("@/lib/db"); await db.socialAccount.update({ where: { id: accountId }, data: { status: "RECONNECT_REQUIRED" } }); },
});
