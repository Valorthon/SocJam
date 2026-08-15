import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { postWithRelationsInclude } from "@/lib/posts";
import { createDraftRouteHandler } from "@/lib/posts/draft-route-handlers";

export const POST = createDraftRouteHandler({
  getAuthenticatedUser,
  findPostByIdempotencyKey: (idempotencyKey) =>
    db.post.findUnique({
      where: { idempotencyKey },
      include: postWithRelationsInclude,
    }),
  findAccounts: (userId, accountIds) =>
    db.socialAccount.findMany({
      where: { id: { in: accountIds }, userId },
    }),
  createDraft: (input) =>
    db.post.create({
      data: {
        userId: input.userId,
        baseText: input.baseText,
        status: "DRAFT",
        idempotencyKey: input.idempotencyKey,
        targets: { create: input.targets },
        media: {
          create: input.media,
        },
      },
      include: postWithRelationsInclude,
    }),
  updateDraft: (id, input) =>
    db.$transaction((transaction) =>
      transaction.post.update({
        where: { id, status: "DRAFT" },
        data: {
          baseText: input.baseText,
          targets: {
            deleteMany: {},
            create: input.targets,
          },
          media: {
            deleteMany: {},
            create: input.media,
          },
        },
        include: postWithRelationsInclude,
      }),
    ),
});
