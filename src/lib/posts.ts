import { Prisma } from "@prisma/client";
import {
  postDetailDtoSchema,
  postListItemDtoSchema,
  type PostDetailDto,
  type PostListItemDto,
} from "@/types";

export const postWithRelationsInclude = {
  targets: {
    include: {
      account: {
        select: {
          id: true,
          platform: true,
          handle: true,
          status: true,
        },
      },
    },
    orderBy: { id: "asc" },
  },
  media: {
    orderBy: { order: "asc" },
  },
} satisfies Prisma.PostInclude;

export type PostWithRelations = Prisma.PostGetPayload<{
  include: typeof postWithRelationsInclude;
}>;

function toIsoString(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function toTargetDto(
  target: PostWithRelations["targets"][number],
) {
  return {
    id: target.id,
    accountId: target.accountId,
    platform: target.platform,
    adaptedText: target.adaptedText,
    status: target.status,
    scheduledAt: toIsoString(target.scheduledAt),
    publishedAt: toIsoString(target.publishedAt),
    publishedUrl: target.publishedUrl,
    error: target.error,
    attempts: target.attempts,
    account: target.account
      ? {
          id: target.account.id,
          platform: target.account.platform,
          handle: target.account.handle,
          status: target.account.status,
          // This relation is loaded without the account target-count aggregate.
          scheduledTargetCount: 0,
        }
      : null,
  };
}

export function toPostListItemDto(post: PostWithRelations): PostListItemDto {
  return postListItemDtoSchema.parse({
    id: post.id,
    baseText: post.baseText,
    status: post.status,
    scheduledAt: toIsoString(post.scheduledAt),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    targets: post.targets.map((target) => {
      const targetDto = toTargetDto(target);

      return {
        id: targetDto.id,
        accountId: targetDto.accountId,
        platform: targetDto.platform,
        status: targetDto.status,
        publishedUrl: targetDto.publishedUrl,
        error: targetDto.error,
        account: targetDto.account,
      };
    }),
  });
}

export function toPostDetailDto(post: PostWithRelations): PostDetailDto {
  return postDetailDtoSchema.parse({
    ...toPostListItemDto(post),
    idempotencyKey: post.idempotencyKey,
    targets: post.targets.map(toTargetDto),
    media: post.media.map((asset) => ({
      id: asset.id,
      url: asset.url,
      type: asset.type,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      order: asset.order,
    })),
  });
}
