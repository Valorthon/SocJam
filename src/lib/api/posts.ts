import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestJson } from "@/lib/api/client";
import {
  createPostSchema,
  postIdParamsSchema,
  type CreatePostInput,
  saveDraftSchema,
  type SaveDraftInput,
} from "@/lib/validations/post";
import {
  postDetailResponseSchema,
  postListResponseSchema,
  type PostDetailDto,
  type PostListItemDto,
} from "@/types";

export const postQueryKeys = {
  all: ["posts"] as const,
  detail: (id: string) => ["posts", id] as const,
};

export interface PostActionInput {
  postId: string;
}

async function fetchPosts(): Promise<PostListItemDto[]> {
  const response = await requestJson(
    "/api/posts",
    { method: "GET" },
    postListResponseSchema,
  );

  return response.posts;
}

async function fetchPost(id: string): Promise<PostDetailDto> {
  const parsed = postIdParamsSchema.safeParse({ id });
  if (!parsed.success) {
    throw new Error("The requested post is invalid.");
  }

  const response = await requestJson(
    `/api/posts/${parsed.data.id}`,
    { method: "GET" },
    postDetailResponseSchema,
  );

  return response.post;
}

async function createPost(input: CreatePostInput): Promise<PostDetailDto> {
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Please review the post details and try again.");
  }

  const response = await requestJson(
    "/api/posts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    },
    postDetailResponseSchema,
  );

  return response.post;
}

async function saveDraft(input: SaveDraftInput): Promise<PostDetailDto> {
  const parsed = saveDraftSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Please review the draft details and try again.");
  }

  const response = await requestJson(
    "/api/posts/drafts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    },
    postDetailResponseSchema,
  );

  return response.post;
}

async function publishPost({ postId }: PostActionInput): Promise<PostDetailDto> {
  const parsed = postIdParamsSchema.safeParse({ id: postId });
  if (!parsed.success) {
    throw new Error("The selected post is invalid.");
  }

  const response = await requestJson(
    `/api/posts/${parsed.data.id}/publish`,
    { method: "POST" },
    postDetailResponseSchema,
  );

  return response.post;
}

async function retryPost({ postId }: PostActionInput): Promise<PostDetailDto> {
  const parsed = postIdParamsSchema.safeParse({ id: postId });
  if (!parsed.success) {
    throw new Error("The selected post is invalid.");
  }

  const response = await requestJson(
    `/api/posts/${parsed.data.id}/retry`,
    { method: "POST" },
    postDetailResponseSchema,
  );

  return response.post;
}

export function usePosts() {
  return useQuery({
    queryKey: postQueryKeys.all,
    queryFn: fetchPosts,
  });
}

export function usePost(id: string | null | undefined) {
  return useQuery({
    queryKey: postQueryKeys.detail(id ?? ""),
    queryFn: () => fetchPost(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPost,
    onSuccess: async (post) => {
      await queryClient.invalidateQueries({ queryKey: postQueryKeys.all });
      queryClient.setQueryData(postQueryKeys.detail(post.id), post);
    },
  });
}

export function useSaveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveDraft,
    onSuccess: async (post) => {
      await queryClient.invalidateQueries({ queryKey: postQueryKeys.all });
      queryClient.setQueryData(postQueryKeys.detail(post.id), post);
    },
  });
}

export function usePublishPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: publishPost,
    onSuccess: async (post) => {
      queryClient.setQueryData(postQueryKeys.detail(post.id), post);
      await queryClient.invalidateQueries({ queryKey: postQueryKeys.all });
    },
  });
}

export function useRetryPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryPost,
    onSuccess: async (post) => {
      queryClient.setQueryData(postQueryKeys.detail(post.id), post);
      await queryClient.invalidateQueries({ queryKey: postQueryKeys.all });
    },
  });
}
