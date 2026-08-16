import { Prisma, type SocialAccount } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { getAuthenticatedUser } from "@/lib/auth";
import { validatePost } from "@/lib/platforms/constraints";
import type { MediaInput } from "@/lib/validations/post";
import {
  toPostDetailDto,
  toPostListItemDto,
  type PostWithRelations,
} from "@/lib/posts";
import { validationErrorSchema } from "@/lib/validations/common";
import {
  createPostSchema,
  postIdParamsSchema,
  updatePostSchema,
} from "@/lib/validations/post";
import { validateScheduledAt } from "@/lib/validations/schedule";
import { postDetailResponseSchema, postListResponseSchema } from "@/types";

type DraftTarget = {
  accountId: string;
  platform: SocialAccount["platform"];
  adaptedText: string;
  status: "DRAFT" | "SCHEDULED";
  scheduledAt?: Date;
};

export interface PostsRouteDependencies {
  getAuthenticatedUser: typeof getAuthenticatedUser;
  findPostByIdempotencyKey: (key: string) => Promise<PostWithRelations | null>;
  findPostsByUser: (userId: string) => Promise<PostWithRelations[]>;
  findActiveAccounts: (
    userId: string,
    accountIds: string[],
  ) => Promise<SocialAccount[]>;
  getUserTimezone: (userId: string) => Promise<string | null>;
  createPost: (input: {
    userId: string;
    baseText: string;
    idempotencyKey: string;
    status: "DRAFT" | "SCHEDULED";
    scheduledAt: Date | null;
    targets: DraftTarget[];
    media: MediaInput[];
  }) => Promise<PostWithRelations>;
}

export interface PostDetailRouteDependencies {
  getAuthenticatedUser: typeof getAuthenticatedUser;
  findPostByIdAndUser: (
    id: string,
    userId: string,
  ) => Promise<PostWithRelations | null>;
}

export interface UpdatePostRouteDependencies {
  getAuthenticatedUser: typeof getAuthenticatedUser;
  findPostByIdAndUser: (
    id: string,
    userId: string,
  ) => Promise<PostWithRelations | null>;
  getUserTimezone: (userId: string) => Promise<string | null>;
  schedulePost: (
    id: string,
    userId: string,
    input: { scheduledAt: Date; updatedAt: Date },
  ) => Promise<PostWithRelations | null>;
  reschedulePost: (
    id: string,
    userId: string,
    input: { scheduledAt: Date; updatedAt: Date },
  ) => Promise<PostWithRelations | null>;
  cancelPost: (
    id: string,
    userId: string,
    input: { updatedAt: Date },
  ) => Promise<PostWithRelations | null>;
}

export interface PublishPostRouteDependencies {
  getAuthenticatedUser: typeof getAuthenticatedUser;
  publishPost: (id: string, userId: string) => Promise<PostWithRelations | null>;
}

export interface RetryPostRouteDependencies {
  getAuthenticatedUser: typeof getAuthenticatedUser;
  retryPost: (id: string, userId: string) => Promise<PostWithRelations | null>;
}

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]),
    ),
  );
}

function invalidRequestResponse(
  error: string,
  errors?: Record<string, string[]>,
): NextResponse {
  const parsed = validationErrorSchema.safeParse({
    error,
    ...(errors ? { fieldErrors: errors } : {}),
  });

  return NextResponse.json(
    parsed.success ? parsed.data : { error: "Invalid request." },
    { status: 400 },
  );
}

function conflictResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unable to create post with this idempotency key." },
    { status: 409 },
  );
}

function stalePostResponse(): NextResponse {
  return NextResponse.json(
    { error: "This post was modified elsewhere. Reload to see changes." },
    { status: 409 },
  );
}

export function createPostsRouteHandlers(dependencies: PostsRouteDependencies) {
  async function GET(): Promise<NextResponse> {
    const authentication = await dependencies.getAuthenticatedUser();
    if (!authentication.ok) {
      return unauthorizedResponse();
    }

    try {
      const posts = await dependencies.findPostsByUser(authentication.userId);
      return NextResponse.json(
        postListResponseSchema.parse({
          posts: posts.map(toPostListItemDto),
        }),
      );
    } catch (error) {
      console.error("Unable to load posts.", error);
      return NextResponse.json(
        { error: "Unable to load posts." },
        { status: 500 },
      );
    }
  }

  async function POST(request: Request): Promise<NextResponse> {
    const authentication = await dependencies.getAuthenticatedUser();
    if (!authentication.ok) {
      return unauthorizedResponse();
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidRequestResponse("Invalid request.");
    }

    const input = createPostSchema.safeParse(body);
    if (!input.success) {
      return invalidRequestResponse("Invalid request.", fieldErrors(input.error));
    }

    const scheduledAt = input.data.scheduledAt
      ? new Date(input.data.scheduledAt)
      : null;
    const isScheduled = scheduledAt !== null;

    try {
      if (isScheduled) {
        const timezone = await dependencies.getUserTimezone(
          authentication.userId,
        );
        if (!timezone) {
          return invalidRequestResponse("Unable to determine your timezone.");
        }

        const scheduleValidation = validateScheduledAt(
          scheduledAt,
          timezone,
          new Date(),
        );
        if (!scheduleValidation.valid) {
          return invalidRequestResponse("Invalid scheduled time.", {
            scheduledAt: [scheduleValidation.error ?? "Invalid scheduled time."],
          });
        }
      }

      const existing = await dependencies.findPostByIdempotencyKey(
        input.data.idempotencyKey,
      );
      if (existing) {
        return existing.userId === authentication.userId
          ? NextResponse.json(
              postDetailResponseSchema.parse({ post: toPostDetailDto(existing) }),
            )
          : conflictResponse();
      }

      const accountIds = input.data.targets.map((target) => target.accountId);
      const accounts = await dependencies.findActiveAccounts(
        authentication.userId,
        accountIds,
      );
      if (accounts.length !== accountIds.length) {
        return invalidRequestResponse(
          "One or more selected accounts are unavailable.",
        );
      }

      const accountsById = new Map(
        accounts.map((account) => [account.id, account]),
      );
      const errors: Record<string, string[]> = {};
      const targets: DraftTarget[] = input.data.targets.map((target, index) => {
        const account = accountsById.get(target.accountId);
        if (!account) {
          throw new Error("Selected account was not loaded.");
        }

        const validation = validatePost(
          account.platform,
          target.adaptedText,
          input.data.media,
        );
        if (!validation.valid) {
          errors[`targets.${index}`] = validation.errors;
        }

        return {
          accountId: account.id,
          platform: account.platform,
          adaptedText: target.adaptedText,
          status: isScheduled ? "SCHEDULED" : "DRAFT",
          ...(isScheduled ? { scheduledAt } : {}),
        };
      });

      if (Object.keys(errors).length > 0) {
        return invalidRequestResponse("Invalid post content.", errors);
      }

      const post = await dependencies.createPost({
        userId: authentication.userId,
        baseText: input.data.baseText,
        idempotencyKey: input.data.idempotencyKey,
        status: isScheduled ? "SCHEDULED" : "DRAFT",
        scheduledAt,
        targets,
        media: input.data.media,
      });
      return NextResponse.json(
        postDetailResponseSchema.parse({ post: toPostDetailDto(post) }),
        { status: 201 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        try {
          const existing = await dependencies.findPostByIdempotencyKey(
            input.data.idempotencyKey,
          );
          if (existing?.userId === authentication.userId) {
            return NextResponse.json(
              postDetailResponseSchema.parse({ post: toPostDetailDto(existing) }),
            );
          }
        } catch (lookupError) {
          console.error("Unable to load idempotent post.", lookupError);
          return NextResponse.json(
            { error: "Unable to create post." },
            { status: 500 },
          );
        }

        return conflictResponse();
      }

      console.error("Unable to create post.", error);
      return NextResponse.json(
        { error: "Unable to create post." },
        { status: 500 },
      );
    }
  }

  return { GET, POST };
}

export function createPostDetailRouteHandler(
  dependencies: PostDetailRouteDependencies,
) {
  return async (
    _request: Request,
    { params }: { params: { id: string } },
  ): Promise<NextResponse> => {
    const authentication = await dependencies.getAuthenticatedUser();
    if (!authentication.ok) {
      return unauthorizedResponse();
    }

    const parsed = postIdParamsSchema.safeParse(params);
    if (!parsed.success) {
      return invalidRequestResponse("Invalid request.", fieldErrors(parsed.error));
    }

    try {
      const post = await dependencies.findPostByIdAndUser(
        parsed.data.id,
        authentication.userId,
      );
      if (!post) {
        return NextResponse.json({ error: "Post not found." }, { status: 404 });
      }

      return NextResponse.json(
        postDetailResponseSchema.parse({ post: toPostDetailDto(post) }),
      );
    } catch (error) {
      console.error("Unable to load post.", error);
      return NextResponse.json(
        { error: "Unable to load post." },
        { status: 500 },
      );
    }
  };
}

export function createUpdatePostRouteHandler(
  dependencies: UpdatePostRouteDependencies,
) {
  return async (
    request: Request,
    { params }: { params: { id: string } },
  ): Promise<NextResponse> => {
    const authentication = await dependencies.getAuthenticatedUser();
    if (!authentication.ok) return unauthorizedResponse();

    const parsedParams = postIdParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return invalidRequestResponse(
        "Invalid request.",
        fieldErrors(parsedParams.error),
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidRequestResponse("Invalid request.");
    }

    const input = updatePostSchema.safeParse(body);
    if (!input.success) {
      return invalidRequestResponse("Invalid request.", fieldErrors(input.error));
    }

    try {
      const post = await dependencies.findPostByIdAndUser(
        parsedParams.data.id,
        authentication.userId,
      );
      if (!post) {
        return NextResponse.json({ error: "Post not found." }, { status: 404 });
      }

      const clientUpdatedAt = new Date(input.data.updatedAt);
      if (post.updatedAt.getTime() !== clientUpdatedAt.getTime()) {
        return stalePostResponse();
      }

      let updated: PostWithRelations | null = null;

      if (input.data.action === "schedule") {
        if (post.status !== "DRAFT") {
          return invalidRequestResponse("Only drafts can be scheduled.", {
            action: ["Only drafts can be scheduled."],
          });
        }

        const timezone = await dependencies.getUserTimezone(
          authentication.userId,
        );
        if (!timezone) {
          return invalidRequestResponse("Unable to determine your timezone.");
        }

        const scheduledAt = new Date(input.data.scheduledAt);
        const scheduleValidation = validateScheduledAt(
          scheduledAt,
          timezone,
          new Date(),
        );
        if (!scheduleValidation.valid) {
          return invalidRequestResponse("Invalid scheduled time.", {
            scheduledAt: [
              scheduleValidation.error ?? "Invalid scheduled time.",
            ],
          });
        }

        updated = await dependencies.schedulePost(
          post.id,
          authentication.userId,
          { scheduledAt, updatedAt: clientUpdatedAt },
        );
      } else if (input.data.action === "reschedule") {
        if (post.status !== "SCHEDULED") {
          return invalidRequestResponse("Only scheduled posts can be rescheduled.", {
            action: ["Only scheduled posts can be rescheduled."],
          });
        }
        const timezone = await dependencies.getUserTimezone(
          authentication.userId,
        );
        if (!timezone) {
          return invalidRequestResponse("Unable to determine your timezone.");
        }

        const scheduledAt = new Date(input.data.scheduledAt);
        const scheduleValidation = validateScheduledAt(
          scheduledAt,
          timezone,
          new Date(),
        );
        if (!scheduleValidation.valid) {
          return invalidRequestResponse("Invalid scheduled time.", {
            scheduledAt: [
              scheduleValidation.error ?? "Invalid scheduled time.",
            ],
          });
        }

        updated = await dependencies.reschedulePost(
          post.id,
          authentication.userId,
          { scheduledAt, updatedAt: clientUpdatedAt },
        );
      } else {
        if (post.status !== "SCHEDULED") {
          return invalidRequestResponse("Only scheduled posts can be cancelled.", {
            action: ["Only scheduled posts can be cancelled."],
          });
        }

        updated = await dependencies.cancelPost(post.id, authentication.userId, {
          updatedAt: clientUpdatedAt,
        });
      }

      if (!updated) {
        return stalePostResponse();
      }

      return NextResponse.json(
        postDetailResponseSchema.parse({ post: toPostDetailDto(updated) }),
      );
    } catch (error) {
      console.error("Unable to update post.", error);
      return NextResponse.json(
        { error: "Unable to update post." },
        { status: 500 },
      );
    }
  };
}

export function createPublishPostRouteHandler(
  dependencies: PublishPostRouteDependencies,
) {
  return async (
    _request: Request,
    { params }: { params: { id: string } },
  ): Promise<NextResponse> => {
    const authentication = await dependencies.getAuthenticatedUser();
    if (!authentication.ok) return unauthorizedResponse();

    const parsed = postIdParamsSchema.safeParse(params);
    if (!parsed.success) {
      return invalidRequestResponse("Invalid request.", fieldErrors(parsed.error));
    }

    try {
      const post = await dependencies.publishPost(parsed.data.id, authentication.userId);
      if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

      return NextResponse.json(
        postDetailResponseSchema.parse({ post: toPostDetailDto(post) }),
      );
    } catch (error) {
      console.error("Unable to publish post.", error);
      return NextResponse.json(
        { error: "Unable to publish post." },
        { status: 500 },
      );
    }
  };
}

export function createRetryPostRouteHandler(
  dependencies: RetryPostRouteDependencies,
) {
  return async (
    _request: Request,
    { params }: { params: { id: string } },
  ): Promise<NextResponse> => {
    const authentication = await dependencies.getAuthenticatedUser();
    if (!authentication.ok) return unauthorizedResponse();

    const parsed = postIdParamsSchema.safeParse(params);
    if (!parsed.success) {
      return invalidRequestResponse("Invalid request.", fieldErrors(parsed.error));
    }

    try {
      const post = await dependencies.retryPost(parsed.data.id, authentication.userId);
      if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

      return NextResponse.json(
        postDetailResponseSchema.parse({ post: toPostDetailDto(post) }),
      );
    } catch (error) {
      console.error("Unable to retry post.", error);
      return NextResponse.json(
        { error: "Unable to retry post." },
        { status: 500 },
      );
    }
  };
}
