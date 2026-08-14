import { cache } from "react";
import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";

const getCurrentAppUser = cache(async () => {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return null;

  return db.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      name: true,
      email: true,
      timezone: true,
    },
  });
});

export const getRequiredAppUser = cache(async () => {
  const user = await getCurrentAppUser();
  if (!user) redirect("/login");

  return user;
});
