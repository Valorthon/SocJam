import { getAuthenticatedUser } from "@/lib/auth";
import { retryFailedTargetsForUser } from "@/lib/posts/retry";
import { createRetryPostRouteHandler } from "@/lib/posts/route-handlers";

export const POST = createRetryPostRouteHandler({
  getAuthenticatedUser,
  retryPost: retryFailedTargetsForUser,
});
