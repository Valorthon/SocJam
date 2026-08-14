import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { requestJson } from "@/lib/api/client";
import {
  aiAdaptRequestSchema,
  aiAdaptationQuotaResponseSchema,
  aiAdaptResponseSchema,
  type AiAdaptRequest,
} from "@/lib/validations/ai";

export type AdaptPostInput = AiAdaptRequest;
export type AdaptPostResult = z.infer<typeof aiAdaptResponseSchema>;
export type AiAdaptationQuotaResult = z.infer<
  typeof aiAdaptationQuotaResponseSchema
>;

async function adaptPost(input: AdaptPostInput): Promise<AdaptPostResult> {
  const parsed = aiAdaptRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Please provide a draft and at least one platform.");
  }

  return requestJson(
    "/api/ai/adapt",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    },
    aiAdaptResponseSchema,
  );
}

export function useAdaptPost() {
  return useMutation({ mutationFn: adaptPost });
}

async function getAiAdaptationQuota(): Promise<AiAdaptationQuotaResult> {
  return requestJson(
    "/api/ai/adapt",
    { method: "GET" },
    aiAdaptationQuotaResponseSchema,
  );
}

export function useAiAdaptationQuota() {
  return useQuery({
    queryKey: ["ai", "adaptation-quota"],
    queryFn: getAiAdaptationQuota,
    staleTime: 30_000,
  });
}
