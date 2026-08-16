import type { PostTarget, PrismaClient } from "@prisma/client";
import { createPublisher } from "@/lib/posts/publisher";
import { postWithRelationsInclude } from "@/lib/posts";
import { derivePostStatus } from "@/lib/posts/status";
import { MISSED_WINDOW_MS } from "@/lib/validations/schedule";

const publishInclude = {
  targets: {
    include: { account: true },
    orderBy: { id: "asc" },
  },
  media: { orderBy: { order: "asc" } },
} as const;

export interface SchedulerDependencies {
  db: PrismaClient;
  now?: () => Date;
}

export async function markMissedTargets(
  dependencies: SchedulerDependencies,
): Promise<string[]> {
  const { db, now = () => new Date() } = dependencies;
  const cutoff = new Date(now().getTime() - MISSED_WINDOW_MS);

  const missedPostIds = await db.$transaction(async (transaction) => {
    const targets = await transaction.postTarget.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: cutoff },
      },
      select: { id: true, postId: true },
    });

    if (targets.length === 0) return [];

    await transaction.postTarget.updateMany({
      where: {
        id: { in: targets.map((target) => target.id) },
        status: "SCHEDULED",
      },
      data: {
        status: "MISSED",
        error: "Scheduled time passed without being published.",
      },
    });

    return Array.from(new Set(targets.map((target) => target.postId)));
  });

  await db.$transaction(async (transaction) => {
    for (const postId of missedPostIds) {
      const targets = await transaction.postTarget.findMany({
        where: { postId },
        select: { status: true },
      });
      await transaction.post.update({
        where: { id: postId },
        data: { status: derivePostStatus(targets) },
      });
    }
  });

  return missedPostIds;
}

type ClaimedTarget = PostTarget & { userId: string };
type ClaimedPost = {
  postId: string;
  userId: string;
  targets: ClaimedTarget[];
};

export async function claimDueScheduledTargets(
  dependencies: SchedulerDependencies,
): Promise<ClaimedPost[]> {
  const { db, now = () => new Date() } = dependencies;
  const cutoff = new Date(now().getTime() - MISSED_WINDOW_MS);

  return db.$transaction(async (transaction) => {
    const targets = await transaction.$queryRaw<ClaimedTarget[]>`
      SELECT pt.*, p."userId"
      FROM "PostTarget" pt
      JOIN "Post" p ON pt."postId" = p.id
      WHERE pt.status = 'SCHEDULED'
        AND pt."scheduledAt" <= ${now()}
        AND pt."scheduledAt" > ${cutoff}
      ORDER BY pt."scheduledAt" ASC
      FOR UPDATE OF pt SKIP LOCKED
    `;

    if (targets.length === 0) return [];

    const targetIds = targets.map((target) => target.id);
    await transaction.postTarget.updateMany({
      where: {
        id: { in: targetIds },
        status: "SCHEDULED",
      },
      data: {
        status: "PUBLISHING",
        attempts: { increment: 1 },
      },
    });

    const postsById = new Map<string, ClaimedPost>();
    for (const target of targets) {
      const existing = postsById.get(target.postId);
      if (existing) {
        existing.targets.push(target);
      } else {
        postsById.set(target.postId, {
          postId: target.postId,
          userId: target.userId,
          targets: [target],
        });
      }
    }

    return Array.from(postsById.values());
  });
}

export function createScheduledPublisher(
  dependencies: Pick<
    PrismaClient,
    "post" | "postTarget" | "socialAccount"
  >,
) {
  return createPublisher({
    claimPost: async (postId, userId) =>
      dependencies.post.findFirst({
        where: { id: postId, userId },
        include: publishInclude,
      }),
    findPost: async (postId, userId) =>
      dependencies.post.findFirst({
        where: { id: postId, userId },
        include: publishInclude,
      }),
    loadResult: async (postId, userId) =>
      dependencies.post.findFirst({
        where: { id: postId, userId },
        include: postWithRelationsInclude,
      }),
    updatePostStatus: async (postId, status) => {
      await dependencies.post.update({ where: { id: postId }, data: { status } });
    },
    markTargetPublishing: async (targetId) => {
      await dependencies.postTarget.update({
        where: { id: targetId },
        data: { status: "PUBLISHING", attempts: { increment: 1 } },
      });
    },
    markTargetPublished: async (targetId, publishedUrl, publishedAt) => {
      await dependencies.postTarget.update({
        where: { id: targetId },
        data: {
          status: "PUBLISHED",
          publishedUrl,
          publishedAt,
          error: null,
        },
      });
    },
    markTargetFailed: async (targetId, error) => {
      await dependencies.postTarget.update({
        where: { id: targetId },
        data: { status: "FAILED", error },
      });
    },
    markAccountReconnectRequired: async (accountId) => {
      await dependencies.socialAccount.update({
        where: { id: accountId },
        data: { status: "RECONNECT_REQUIRED" },
      });
    },
    publishableStatuses: ["PUBLISHING"],
    skipMarkTargetPublishing: true,
  });
}

export async function publishDueScheduledTargets(
  dependencies: SchedulerDependencies,
): Promise<void> {
  const { db } = dependencies;
  await markMissedTargets(dependencies);
  const posts = await claimDueScheduledTargets(dependencies);
  const publisher = createScheduledPublisher(db);

  for (const post of posts) {
    try {
      await publisher(post.postId, post.userId);
    } catch (error) {
      console.error("Unable to publish scheduled post.", {
        postId: post.postId,
        userId: post.userId,
        error,
      });
    }
  }
}
