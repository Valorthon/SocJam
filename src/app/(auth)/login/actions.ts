"use server";

import { isRedirectError } from "next/dist/client/components/redirect";

import { getCredentialsThrottleError, signIn } from "@/lib/auth";

export interface LoginResult {
  success: boolean;
  error?: string;
}

function isLoginInput(value: unknown): value is { email: string; password: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "email" in value &&
    "password" in value &&
    typeof value.email === "string" &&
    typeof value.password === "string"
  );
}

export async function loginUser(formData: unknown): Promise<LoginResult> {
  const throttleError = getCredentialsThrottleError(formData);
  if (throttleError) {
    return {
      success: false,
      error: throttleError,
    };
  }

  if (!isLoginInput(formData)) {
    return {
      success: false,
      error: "Invalid email or password.",
    };
  }

  try {
    await signIn("credentials", {
      email: formData.email,
      password: formData.password,
      redirect: false,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    return {
      success: false,
      error: "Invalid email or password.",
    };
  }

  return { success: true };
}
