import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestJson, requestNoContent } from "@/lib/api/client";
import {
  accountIdParamsSchema,
  connectAccountSchema,
  type ConnectAccountInput,
} from "@/lib/validations/account";
import {
  accountListResponseSchema,
  accountResponseSchema,
  type SocialAccountDto,
} from "@/types";

export const accountQueryKeys = {
  all: ["accounts"] as const,
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
