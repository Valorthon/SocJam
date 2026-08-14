import { getAuthenticatedUser } from "@/lib/auth";
import { createPostDetailRouteHandler } from "@/lib/posts/route-handlers";
import { db } from "@/lib/db";
import { postWithRelationsInclude } from "@/lib/posts";

export const GET = createPostDetailRouteHandler({
  getAuthenticatedUser,
  findPostByIdAndUser: (id, userId) =>
    db.post.findFirst({ where: { id, userId }, include: postWithRelationsInclude }),
});
