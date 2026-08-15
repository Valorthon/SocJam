import assert from "node:assert/strict";
import { Prisma, type SocialAccount } from "@prisma/client";
import {
  createAccountsRouteHandlers,
  type AccountsRouteDependencies,
} from "../src/lib/accounts/route-handlers";
import {
  createAccountRouteHandlers,
  createDisconnectAccountForUser,
  type AccountRouteDependencies,
} from "../src/lib/accounts/route-handlers";

process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ??
  "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";

const userId = "user-1";
const missingAccountId = "cly8kq9f10000abcd12345678";
const accountWithTargetsId = "cly8kq9f10001abcd12345678";
const removableAccountId = "cly8kq9f10002abcd12345678";

function authenticatedUser() {
  return async () => ({ ok: true as const, userId });
}

function createSocialAccount(id: string, handle: string): SocialAccount {
  return {
    id,
    userId,
    platform: "X",
    handle,
    accessToken: "mock-token",
    refreshToken: null,
    expiresAt: null,
    scope: null,
    platformUserId: null,
    status: "ACTIVE",
  };
}

async function run(): Promise<void> {
  const accounts = [
    createSocialAccount("cly8kq9f10003abcd12345678", "@other"),
  ];
  const accountDependencies: AccountsRouteDependencies = {
    getAuthenticatedUser: authenticatedUser(),
    socialAccounts: {
      findMany: async ({ where }: { where: { userId: string } }) =>
        accounts.filter((account) => account.userId === where.userId),
      create: async ({
        data,
      }: {
        data: Pick<SocialAccount, "userId" | "platform" | "handle" | "accessToken" | "status">;
      }) => {
        if (
          accounts.some(
            (account) =>
              account.userId === data.userId &&
              account.platform === data.platform &&
              account.handle === data.handle,
          )
        ) {
          throw new Prisma.PrismaClientKnownRequestError("Duplicate account", {
            code: "P2002",
            clientVersion: "test",
          });
        }

        const account = {
          id: removableAccountId,
          ...data,
          refreshToken: null,
          expiresAt: null,
          scope: null,
          platformUserId: null,
        };
        accounts.push(account);
        return account as SocialAccount;
      },
    } as unknown as AccountsRouteDependencies["socialAccounts"],
    createMockAccessToken: () => "generated-token",
  };
  const accountHandlers = createAccountsRouteHandlers(accountDependencies);

  const unauthenticatedHandlers = createAccountsRouteHandlers({
    ...accountDependencies,
    getAuthenticatedUser: async () => ({ ok: false as const }),
  });
  assert.equal((await unauthenticatedHandlers.GET()).status, 401);
  assert.equal((await unauthenticatedHandlers.POST(new Request("http://localhost"))).status, 401);

  const createResponse = await accountHandlers.POST(
    new Request("http://localhost/api/accounts", {
      method: "POST",
      body: JSON.stringify({ platform: "X", handle: "@omnipost" }),
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(createResponse.status, 201);
  assert.deepEqual(await createResponse.json(), {
    account: {
      id: removableAccountId,
      platform: "X",
      handle: "@omnipost",
      status: "ACTIVE",
      scheduledTargetCount: 0,
    },
  });

  const listResponse = await accountHandlers.GET();
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).accounts.length, 2);

  const duplicateResponse = await accountHandlers.POST(
    new Request("http://localhost/api/accounts", {
      method: "POST",
      body: JSON.stringify({ platform: "X", handle: "@omnipost" }),
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(duplicateResponse.status, 409);

  const invalidResponse = await accountHandlers.POST(
    new Request("http://localhost/api/accounts", {
      method: "POST",
      body: JSON.stringify({ platform: "INVALID", handle: "" }),
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(invalidResponse.status, 400);
  assert.ok((await invalidResponse.json()).fieldErrors.platform);

  const publishedOnlyAccountId = "cly8kq9f10004abcd12345678";
  const mixedAccountId = "cly8kq9f10005abcd12345678";
  let cancellation: { status: string; error: string } | null = null;
  const disconnectedAccountIds: string[] = [];
  const targets: Array<{
    accountId: string | null;
    postId: string;
    status: "SCHEDULED" | "PUBLISHED" | "CANCELLED";
  }> = [
    { accountId: accountWithTargetsId, postId: "post-scheduled", status: "SCHEDULED" },
    { accountId: publishedOnlyAccountId, postId: "post-published", status: "PUBLISHED" },
    { accountId: mixedAccountId, postId: "post-mixed", status: "SCHEDULED" },
    { accountId: "connected-account", postId: "post-mixed", status: "PUBLISHED" },
  ];
  const postStatuses = new Map<string, string>();
  const disconnectScheduledAccount = createDisconnectAccountForUser({
    transact: async (operation) =>
      operation({
        socialAccount: {
          findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
            if (where.userId !== userId) return null;

            return {
              id: where.id,
              targets: targets
                .filter((target) => target.accountId === where.id)
                .map(({ postId, status }) => ({ postId, status })),
            };
          },
          delete: async ({ where }: { where: { id: string } }) => {
            disconnectedAccountIds.push(where.id);
            targets.forEach((target) => {
              if (target.accountId === where.id) target.accountId = null;
            });
          },
        },
        postTarget: {
          updateMany: async ({
            where,
            data,
          }: {
            where: { accountId: string; status: string };
            data: { status: string; error: string };
          }) => {
            cancellation = data;
            targets.forEach((target) => {
              if (target.accountId === where.accountId && target.status === where.status) {
                target.status = "CANCELLED";
              }
            });
          },
          findMany: async ({ where }: { where: { postId: string } }) =>
            targets
              .filter((target) => target.postId === where.postId)
              .map(({ status }) => ({ status })),
        },
        post: {
          update: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: { status: string };
          }) => {
            postStatuses.set(where.id, data.status);
          },
        },
      } as unknown as Parameters<typeof operation>[0]),
  });
  assert.deepEqual(
    await disconnectScheduledAccount(accountWithTargetsId, userId),
    { scheduledTargetCount: 1 },
  );
  assert.deepEqual(cancellation, {
    status: "CANCELLED",
    error: "Cancelled because its account was disconnected.",
  });
  assert.deepEqual(disconnectedAccountIds, [accountWithTargetsId]);
  assert.equal(postStatuses.get("post-scheduled"), "FAILED");
  assert.equal(targets.find((target) => target.postId === "post-scheduled")?.status, "CANCELLED");

  assert.deepEqual(
    await disconnectScheduledAccount(publishedOnlyAccountId, userId),
    { scheduledTargetCount: 0 },
  );
  assert.equal(postStatuses.get("post-published"), "PUBLISHED");

  assert.deepEqual(
    await disconnectScheduledAccount(mixedAccountId, userId),
    { scheduledTargetCount: 1 },
  );
  assert.equal(postStatuses.get("post-mixed"), "PARTIALLY_FAILED");

  const deleteHandlerAccountIds: string[] = [];
  const disconnectDependencies: AccountRouteDependencies = {
    getAuthenticatedUser: authenticatedUser(),
    disconnectAccount: async (accountId) => {
      deleteHandlerAccountIds.push(accountId);
      if (accountId === missingAccountId) return null;

      return {
        scheduledTargetCount: accountId === accountWithTargetsId ? 1 : 0,
      };
    },
  };
  const disconnectHandlers = createAccountRouteHandlers(disconnectDependencies);

  const unauthenticatedDisconnectHandlers = createAccountRouteHandlers({
    ...disconnectDependencies,
    getAuthenticatedUser: async () => ({ ok: false as const }),
  });
  assert.equal(
    (
      await unauthenticatedDisconnectHandlers.DELETE(new Request("http://localhost"), {
        params: { id: removableAccountId },
      })
    ).status,
    401,
  );

  const missingResponse = await disconnectHandlers.DELETE(new Request("http://localhost"), {
    params: { id: missingAccountId },
  });
  assert.equal(missingResponse.status, 404);

  const scheduledTargetResponse = await disconnectHandlers.DELETE(new Request("http://localhost"), {
    params: { id: accountWithTargetsId },
  });
  assert.equal(scheduledTargetResponse.status, 204);
  assert.deepEqual(deleteHandlerAccountIds, [missingAccountId, accountWithTargetsId]);

  const deleteResponse = await disconnectHandlers.DELETE(new Request("http://localhost"), {
    params: { id: removableAccountId },
  });
  assert.equal(deleteResponse.status, 204);

  const invalidIdResponse = await disconnectHandlers.DELETE(new Request("http://localhost"), {
    params: { id: "not-a-cuid" },
  });
  assert.equal(invalidIdResponse.status, 400);
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
