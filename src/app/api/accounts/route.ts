import { randomUUID } from "crypto";
import { getAuthenticatedUser } from "@/lib/auth";
import { createAccountsRouteHandlers } from "@/lib/accounts/route-handlers";
import { db } from "@/lib/db";

const handlers = createAccountsRouteHandlers({
  getAuthenticatedUser,
  socialAccounts: db.socialAccount,
  createMockAccessToken: randomUUID,
});

export const { GET, POST } = handlers;
