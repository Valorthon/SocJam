import type { MediaAsset, PostStatus, SocialAccount, TargetStatus } from "@prisma/client";
import { getPlatformAdapter } from "@/lib/platforms/registry";
import type { Platform } from "@/lib/platforms/constraints";
import type { SocialPlatformAdapter } from "@/lib/platforms/types";
import { postWithRelationsInclude, type PostWithRelations } from "@/lib/posts";
import { safePublishError } from "@/lib/posts/publisher";
import { derivePostStatus } from "@/lib/posts/status";

type RetryablePost = {
  id: string;
  userId: string;
  idempotencyKey: string;
  media: MediaAsset[];
  targets: Array<{
    id: string;
    accountId: string | null;
    platform: Platform;
    adaptedText: string;
    status: TargetStatus;
    attempts: number;
    account: SocialAccount | null;
  }>;
};

export interface RetryPublisherDependencies {
  claimFailedTargets: (postId: string, userId: string) => Promise<RetryablePost | null>;
  findPost: (postId: string, userId: string) => Promise<RetryablePost | null>;
  loadResult: (postId: string, userId: string) => Promise<PostWithRelations | null>;
  updatePostStatus: (postId: string, status: PostStatus) => Promise<void>;
  markTargetPublished: (targetId: string, publishedUrl: string, publishedAt: Date) => Promise<void>;
  markTargetFailed: (targetId: string, error: string) => Promise<void>;
  markAccountReconnectRequired: (accountId: string) => Promise<void>;
  getAdapter?: (platform: Platform) => SocialPlatformAdapter;
  now?: () => Date;
}

export function createRetryPublisher(dependencies: RetryPublisherDependencies) {
  return async function retryPost(postId: string, userId: string): Promise<PostWithRelations | null> {
    const post = await dependencies.claimFailedTargets(postId, userId);
    if (!post) return dependencies.loadResult(postId, userId);

    const retryTargets = post.targets.filter((target) => target.status === "PUBLISHING");
    const getAdapter = dependencies.getAdapter ?? getPlatformAdapter;
    const now = dependencies.now ?? (() => new Date());

    for (const target of retryTargets) {
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
          await dependencies.markTargetFailed(
            target.id,
            `Reconnect your ${target.platform} account to publish this target.`,
          );
          continue;
        }

        const result = await adapter.publishPost({
          targetId: target.id,
          idempotencyKey: post.idempotencyKey,
          text: target.adaptedText,
          media: post.media,
          account: target.account,
        });

        if (result.ok) {
          await dependencies.markTargetPublished(target.id, result.publishedUrl, now());
        } else {
          if (result.authExpired) await dependencies.markAccountReconnectRequired(target.accountId);
          await dependencies.markTargetFailed(target.id, safePublishError(result, target.platform));
        }
      } catch (error) {
        console.error("Unable to retry target.", { postId: post.id, targetId: target.id, error });
        await dependencies.markTargetFailed(target.id, "Unable to publish this target.");
      }
    }

    const updated = await dependencies.findPost(post.id, userId);
    if (!updated) return null;
    await dependencies.updatePostStatus(post.id, derivePostStatus(updated.targets));
    return dependencies.loadResult(post.id, userId);
  };
}

const retryInclude = {
  targets: {
    include: { account: true },
    orderBy: { id: "asc" },
  },
  media: { orderBy: { order: "asc" } },
} as const;

export const retryFailedTargetsForUser = createRetryPublisher({
  claimFailedTargets: async (postId, userId) => {
    const { db } = await import("@/lib/db");
    return db.$transaction(async (transaction) => {
      const claim = await transaction.post.updateMany({
        where: { id: postId, userId, status: { in: ["FAILED", "PARTIALLY_FAILED"] } },
        data: { status: "PUBLISHING" },
      });
      if (claim.count === 0) return null;

      await transaction.postTarget.updateMany({
        where: { postId, status: "FAILED" },
        data: { status: "PUBLISHING", attempts: { increment: 1 } },
      });

      return transaction.post.findFirst({ where: { id: postId, userId }, include: retryInclude });
    });
  },
  findPost: async (postId, userId) => {
    const { db } = await import("@/lib/db");
    return db.post.findFirst({ where: { id: postId, userId }, include: retryInclude });
  },
  loadResult: async (postId, userId) => {
    const { db } = await import("@/lib/db");
    return db.post.findFirst({ where: { id: postId, userId }, include: postWithRelationsInclude });
  },
  updatePostStatus: async (postId, status) => {
    const { db } = await import("@/lib/db");
    await db.post.update({ where: { id: postId }, data: { status } });
  },
  markTargetPublished: async (targetId, publishedUrl, publishedAt) => {
    const { db } = await import("@/lib/db");
    await db.postTarget.update({ where: { id: targetId }, data: { status: "PUBLISHED", publishedUrl, publishedAt, error: null } });
  },
  markTargetFailed: async (targetId, error) => {
    const { db } = await import("@/lib/db");
    await db.postTarget.update({ where: { id: targetId }, data: { status: "FAILED", error } });
  },
  markAccountReconnectRequired: async (accountId) => {
    const { db } = await import("@/lib/db");
    await db.socialAccount.update({ where: { id: accountId }, data: { status: "RECONNECT_REQUIRED" } });
  },
});
