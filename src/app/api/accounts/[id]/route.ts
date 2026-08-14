import { getAuthenticatedUser } from "@/lib/auth";
import {
  createAccountRouteHandlers,
  disconnectAccountForUser,
} from "@/lib/accounts/route-handlers";

const handlers = createAccountRouteHandlers({
  getAuthenticatedUser,
  disconnectAccount: disconnectAccountForUser,
});

export const { DELETE } = handlers;
