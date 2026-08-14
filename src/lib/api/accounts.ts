import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { requestJson, requestNoContent } from "@/lib/api/client";
import {
  accountIdParamsSchema,
  connectAccountSchema,
  connectModeResponseSchema,
  finalizeOauthSchema,
  metaPageListResponseSchema,
  type ConnectAccountInput,
  type ConnectModeResponse,
  type MetaPage,
  type MetaPageListResponse,
} from "@/lib/validations/account";
import {
  accountListResponseSchema,
  accountResponseSchema,
  type SocialAccountDto,
} from "@/types";

export const accountQueryKeys = {
  all: ["accounts"] as const,
  connectMode: ["accounts", "connect-mode"] as const,
  metaPages: ["accounts", "meta", "pages"] as const,
};

async function fetchAccounts(): Promise<SocialAccountDto[]> {
  const response = await requestJson(
    "/api/accounts",
    { method: "GET" },
    accountListResponseSchema,
  );

  return response.accounts;
}

async function connectAccount(
  input: ConnectAccountInput,
): Promise<SocialAccountDto> {
  const parsed = connectAccountSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Please provide a valid platform and account handle.");
  }

  const response = await requestJson(
    "/api/accounts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    },
    accountResponseSchema,
  );

  return response.account;
}

async function disconnectAccount(accountId: string): Promise<void> {
  const parsed = accountIdParamsSchema.safeParse({ id: accountId });
  if (!parsed.success) {
    throw new Error("The selected account is invalid.");
  }

  await requestNoContent(`/api/accounts/${parsed.data.id}`, {
    method: "DELETE",
  });
}

async function fetchConnectMode(): Promise<ConnectModeResponse> {
  return requestJson(
    "/api/accounts/connect-mode",
    { method: "GET" },
    connectModeResponseSchema,
  );
}

async function fetchMetaPages(): Promise<MetaPage[]> {
  const response = await requestJson(
    "/api/oauth/meta/pages",
    { method: "GET" },
    metaPageListResponseSchema,
  );
  return response.pages;
}

async function finalizeMetaConnection(input: { pageId: string }): Promise<void> {
  const parsed = finalizeOauthSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Please select a page to finalize the connection.");
  }

  await requestJson(
    "/api/oauth/meta/finalize",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    },
    z.object({ ok: z.literal(true) }),
  );
}

export function useAccounts() {
  return useQuery({
    queryKey: accountQueryKeys.all,
    queryFn: fetchAccounts,
  });
}

export function useConnectAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: connectAccount,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
    },
  });
}

export function useDisconnectAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: disconnectAccount,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
    },
  });
}

export function useConnectMode() {
  return useQuery({
    queryKey: accountQueryKeys.connectMode,
    queryFn: fetchConnectMode,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMetaPages() {
  return useQuery({
    queryKey: accountQueryKeys.metaPages,
    queryFn: fetchMetaPages,
    retry: false,
  });
}

export function useFinalizeMetaConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: finalizeMetaConnection,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
    },
  });
}
