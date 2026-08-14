"use server";

import argon2 from "argon2";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validations/auth";

export type RegisterFieldErrors = Partial<
  Record<"name" | "email" | "password" | "confirmPassword", string>
>;

export interface RegisterResult {
  success: boolean;
  error?: string;
  fieldErrors?: RegisterFieldErrors;
}

export async function registerUser(
  formData: unknown,
): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(formData);
  if (!parsed.success) {
    const fieldErrors: RegisterFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (
        typeof field === "string" &&
        field in registerSchema.shape &&
        !(field in fieldErrors)
      ) {
        fieldErrors[field as keyof RegisterFieldErrors] = issue.message;
      }
    }

    return {
      success: false,
      error: "Invalid input. Please check your details.",
      fieldErrors,
    };
  }

  const { name, email, password } = parsed.data;

  try {
    const normalizedEmail = email.toLowerCase();
    const existing = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return {
        success: false,
        error: "An account with this email already exists.",
      };
    }

    const passwordHash = await argon2.hash(password);

    await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "An account with this email already exists.",
      };
    }

    return {
      success: false,
      error: "Unable to create your account. Please try again.",
    };
  }

  return { success: true };
}
