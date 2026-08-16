import { getAuthenticatedUser } from "@/lib/auth";
import { getMediaStorage } from "@/lib/storage";
import { createUploadRouteHandlers } from "@/lib/uploads/route-handlers";

const handlers = createUploadRouteHandlers({
  getAuthenticatedUser,
  storage: getMediaStorage(),
});

export async function GET(
  request: Request,
  { params }: { params: { fileName: string } },
) {
  const authentication = await getAuthenticatedUser();
  if (!authentication.ok) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return handlers.GET(request, params.fileName);
}