import { getAuthenticatedUser } from "@/lib/auth";
import { getMediaStorage } from "@/lib/storage";
import { createUploadRouteHandlers } from "@/lib/uploads/route-handlers";

const handlers = createUploadRouteHandlers({
  getAuthenticatedUser,
  storage: getMediaStorage(),
});

export const POST = handlers.POST;