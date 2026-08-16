import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { postWithRelationsInclude } from "@/lib/posts";
import {
  createPostDetailRouteHandler,
  createUpdatePostRouteHandler,
} from "@/lib/posts/route-handlers";
import { derivePostStatus } from "@/lib/posts/status";

export const GET = createPostDetailRouteHandler({
  getAuthenticatedUser,
  findPostByIdAndUser: (id, userId) =>
    db.post.findFirst({ where: { id, userId }, include: postWithRelationsInclude }),
});

export const PATCH = createUpdatePostRouteHandler({
  getAuthenticatedUser,
  findPostByIdAndUser: (id, userId) =>
    db.post.findFirst({ where: { id, userId }, include: postWithRelationsInclude }),
  getUserTimezone: async (userId) => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return user?.timezone ?? null;
  },
  schedulePost: async (id, userId, input) => {
    return db.$transaction(async (transaction) => {
      const claim = await transaction.post.updateMany({
        where: {
          id,
          userId,
          status: "DRAFT",
          updatedAt: input.updatedAt,
        },
        data: {
          status: "SCHEDULED",
          scheduledAt: input.scheduledAt,
        },
      });
      if (claim.count === 0) return null;

      await transaction.postTarget.updateMany({
        where: { postId: id, status: "DRAFT" },
        data: {
          status: "SCHEDULED",
          scheduledAt: input.scheduledAt,
          error: null,
        },
      });

      return transaction.post.findFirst({
        where: { id, userId },
        include: postWithRelationsInclude,
      });
    });
  },
  reschedulePost: async (id, userId, input) => {
    return db.$transaction(async (transaction) => {
      const claim = await transaction.post.updateMany({
        where: {
          id,
          userId,
          status: "SCHEDULED",
          updatedAt: input.updatedAt,
        },
        data: { scheduledAt: input.scheduledAt },
      });
      if (claim.count === 0) return null;

      await transaction.postTarget.updateMany({
        where: { postId: id, status: "SCHEDULED" },
        data: { scheduledAt: input.scheduledAt, error: null },
      });

      return transaction.post.findFirst({
        where: { id, userId },
        include: postWithRelationsInclude,
      });
    });
  },
  cancelPost: async (id, userId, input) => {
    return db.$transaction(async (transaction) => {
      const claim = await transaction.post.updateMany({
        where: {
          id,
          userId,
          status: "SCHEDULED",
          updatedAt: input.updatedAt,
        },
        data: {},
      });
      if (claim.count === 0) return null;

      await transaction.postTarget.updateMany({
        where: { postId: id, status: "SCHEDULED" },
        data: {
          status: "CANCELLED",
          error: "Cancelled by user.",
        },
      });

      const targets = await transaction.postTarget.findMany({
        where: { postId: id },
        select: { status: true },
      });
      const status = derivePostStatus(targets);
      await transaction.post.update({
        where: { id },
        data: { status },
      });

      return transaction.post.findFirst({
        where: { id, userId },
        include: postWithRelationsInclude,
      });
    });
  },
});
