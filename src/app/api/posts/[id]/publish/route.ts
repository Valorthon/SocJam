import { getAuthenticatedUser } from "@/lib/auth";
import { publishPostForUser } from "@/lib/posts/publisher";
import { createPublishPostRouteHandler } from "@/lib/posts/route-handlers";

export const POST = createPublishPostRouteHandler({
  getAuthenticatedUser,
  publishPost: publishPostForUser,
});
