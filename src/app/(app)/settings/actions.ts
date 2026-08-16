"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export interface UpdateTimezoneResult {
  success: boolean;
  error?: string;
}

export async function updateUserTimezone(
  timeZone: string,
): Promise<UpdateTimezoneResult> {
  const authentication = await getAuthenticatedUser();
  if (!authentication.ok) {
    return { success: false, error: "You must be signed in." };
  }

  if (!timeZone || typeof timeZone !== "string") {
    return { success: false, error: "Invalid timezone." };
  }

  if (!isValidTimeZone(timeZone)) {
    return { success: false, error: "Unsupported timezone." };
  }

  try {
    await db.user.update({
      where: { id: authentication.userId },
      data: { timezone: timeZone },
    });
    revalidatePath("/settings/accounts");
    revalidatePath("/compose");
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    return { success: true };
  } catch {
    return { success: false, error: "Unable to save timezone." };
  }
}
