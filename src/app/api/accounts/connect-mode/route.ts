import { getAuthenticatedUser } from "@/lib/auth";
import {
  isFacebookRealEnabled,
  isInstagramRealEnabled,
  isLinkedInRealEnabled,
} from "@/lib/platforms/config";
import { createConnectModeRouteHandlers } from "@/lib/accounts/connect-mode-handlers";

const handlers = createConnectModeRouteHandlers({
  getAuthenticatedUser,
  isLinkedInRealEnabled,
  isFacebookRealEnabled,
  isInstagramRealEnabled,
});

export const GET = handlers.GET;