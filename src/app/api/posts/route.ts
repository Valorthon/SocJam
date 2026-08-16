import { Prisma } from "@prisma/client";
import { getAuthenticatedUser } from "@/lib/auth";
import { createPostsRouteHandlers } from "@/lib/posts/route-handlers";
import { db } from "@/lib/db";
import { postWithRelationsInclude } from "@/lib/posts";

const handlers = createPostsRouteHandlers({
  getAuthenticatedUser,
  findPostByIdempotencyKey: (idempotencyKey) =>
    db.post.findUnique({
      where: { idempotencyKey },
      include: postWithRelationsInclude,
    }),
  findPostsByUser: (userId) =>
    db.post.findMany({
      where: { userId },
      include: postWithRelationsInclude,
      orderBy: { createdAt: "desc" },
    }),
  findActiveAccounts: (userId, accountIds) =>
    db.socialAccount.findMany({
      where: { id: { in: accountIds }, userId, status: "ACTIVE" },
    }),
  getUserTimezone: async (userId) => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return user?.timezone ?? null;
  },
  createPost: (input) =>
    db.$transaction((transaction) =>
      transaction.post.create({
        data: {
          userId: input.userId,
          baseText: input.baseText,
          status: input.status,
          scheduledAt: input.scheduledAt,
          idempotencyKey: input.idempotencyKey,
          targets: { create: input.targets },
          media: {
            create: input.media,
          },
        },
        include: postWithRelationsInclude,
      }),
    ),
});

export const { GET, POST } = handlers;
