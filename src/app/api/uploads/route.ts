import { getAuthenticatedUser } from "@/lib/auth";
import { LocalMediaStorage } from "@/lib/storage/local";
import { createUploadRouteHandlers } from "@/lib/uploads/route-handlers";

const handlers = createUploadRouteHandlers({
  getAuthenticatedUser,
  storage: new LocalMediaStorage(),
});

export const POST = handlers.POST;
