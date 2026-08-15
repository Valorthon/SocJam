import { Prisma, type SocialAccount } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { derivePostStatus } from "@/lib/posts/status";
import {
  accountIdParamsSchema,
  connectAccountSchema,
} from "@/lib/validations/account";
import { validationErrorSchema } from "@/lib/validations/common";
import { encryptToken } from "@/lib/tokens/crypto";
import {
  accountListResponseSchema,
  accountResponseSchema,
  socialAccountDtoSchema,
} from "@/types";

interface AccountRouteContext {
  params: { id: string };
}

export interface AccountsRouteDependencies {
  getAuthenticatedUser: typeof getAuthenticatedUser;
  socialAccounts: Pick<typeof db.socialAccount, "findMany" | "create">;
  createMockAccessToken: () => string;
  encryptToken?: (token: string) => string;
}

type DisconnectAccountResult = {
  scheduledTargetCount: number;
};

type DisconnectTransaction = {
  socialAccount: Pick<typeof db.socialAccount, "findFirst" | "delete">;
  postTarget: Pick<typeof db.postTarget, "updateMany" | "findMany">;
  post: Pick<typeof db.post, "update">;
};

export interface DisconnectAccountDependencies {
  transact: <Result>(
    operation: (transaction: DisconnectTransaction) => Promise<Result>,
  ) => Promise<Result>;
}

export interface AccountRouteDependencies {
  getAuthenticatedUser: typeof getAuthenticatedUser;
  disconnectAccount: (
    accountId: string,
    userId: string,
  ) => Promise<DisconnectAccountResult | null>;
}

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function toSocialAccountDto(
  account: SocialAccount & { _count?: { targets: number } },
) {
  return socialAccountDtoSchema.parse({
    id: account.id,
    platform: account.platform,
    handle: account.handle,
    status: account.status,
    scheduledTargetCount: account._count?.targets ?? 0,
  });
}

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]),
    ),
  );
}

function invalidRequestResponse(error?: z.ZodError): NextResponse {
  return NextResponse.json(
    validationErrorSchema.parse({
      error: "Invalid request.",
      ...(error ? { fieldErrors: toFieldErrors(error) } : {}),
    }),
    { status: 400 },
  );
}

export function createAccountsRouteHandlers(dependencies: AccountsRouteDependencies) {
  const { createMockAccessToken, getAuthenticatedUser, socialAccounts } = dependencies;
  const encrypt = dependencies.encryptToken ?? encryptToken;

  async function GET(): Promise<NextResponse> {
    const authentication = await getAuthenticatedUser();
    if (!authentication.ok) {
      return unauthorizedResponse();
    }

    try {
      const accounts = await socialAccounts.findMany({
        where: { userId: authentication.userId },
        orderBy: [{ platform: "asc" }, { handle: "asc" }],
        include: {
          _count: {
            select: {
              targets: { where: { status: "SCHEDULED" } },
            },
          },
        },
      });

      return NextResponse.json(
        accountListResponseSchema.parse({
          accounts: accounts.map(toSocialAccountDto),
        }),
      );
    } catch {
      return NextResponse.json(
        { error: "Unable to load accounts." },
        { status: 500 },
      );
    }
  }

  async function POST(request: Request): Promise<NextResponse> {
    const authentication = await getAuthenticatedUser();
    if (!authentication.ok) {
      return unauthorizedResponse();
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidRequestResponse();
    }

    const input = connectAccountSchema.safeParse(body);
    if (!input.success) {
      return invalidRequestResponse(input.error);
    }

    try {
      const account = await socialAccounts.create({
        data: {
          userId: authentication.userId,
          platform: input.data.platform,
          handle: input.data.handle,
          accessToken: encrypt(`mock_${createMockAccessToken()}`),
          status: "ACTIVE",
        },
      });

      return NextResponse.json(
        accountResponseSchema.parse({ account: toSocialAccountDto(account) }),
        { status: 201 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "This account is already connected." },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: "Unable to connect account." },
        { status: 500 },
      );
    }
  }

  return { GET, POST };
}

export function createAccountRouteHandlers(dependencies: AccountRouteDependencies) {
  const { disconnectAccount, getAuthenticatedUser } = dependencies;

  async function DELETE(
    _request: Request,
    { params }: AccountRouteContext,
  ): Promise<NextResponse> {
    const authentication = await getAuthenticatedUser();
    if (!authentication.ok) {
      return unauthorizedResponse();
    }

    const accountParams = accountIdParamsSchema.safeParse(params);
    if (!accountParams.success) {
      return invalidRequestResponse(accountParams.error);
    }

    try {
      const account = await disconnectAccount(
        accountParams.data.id,
        authentication.userId,
      );

      if (!account) {
        return NextResponse.json({ error: "Account not found." }, { status: 404 });
      }

      return new NextResponse(null, { status: 204 });
    } catch {
      return NextResponse.json(
        { error: "Unable to disconnect account." },
        { status: 500 },
      );
    }
  }

  return { DELETE };
}

export function createDisconnectAccountForUser(
  dependencies: DisconnectAccountDependencies,
) {
  return async function disconnectAccountForUser(
    accountId: string,
    userId: string,
  ): Promise<DisconnectAccountResult | null> {
    return dependencies.transact(async (transaction) => {
      const account = await transaction.socialAccount.findFirst({
        where: { id: accountId, userId },
        select: {
          id: true,
          targets: {
            select: {
              postId: true,
              status: true,
            },
          },
        },
      });

      if (!account) return null;

      const scheduledTargets = account.targets.filter(
        (target) => target.status === "SCHEDULED",
      );
      const affectedPostIds = Array.from(
        new Set(account.targets.map((target) => target.postId)),
      );
      if (scheduledTargets.length > 0) {
        await transaction.postTarget.updateMany({
          where: {
            accountId: account.id,
            status: "SCHEDULED",
          },
          data: {
            status: "CANCELLED",
            error: "Cancelled because its account was disconnected.",
          },
        });
      }

      await transaction.socialAccount.delete({ where: { id: account.id } });

      for (const postId of affectedPostIds) {
        const targets = await transaction.postTarget.findMany({
          where: { postId },
          select: { status: true },
        });
        await transaction.post.update({
          where: { id: postId },
          data: { status: derivePostStatus(targets) },
        });
      }

      return { scheduledTargetCount: scheduledTargets.length };
    });
  };
}

export const disconnectAccountForUser = createDisconnectAccountForUser({
  transact: (operation) => db.$transaction(operation),
});
