import { redirect } from "next/navigation";

import { OnboardingAccountList } from "@/components/features/accounts/OnboardingAccountList";
import { OnboardingTimezoneSync } from "@/components/features/onboarding/OnboardingTimezoneSync";
import { getAuthenticatedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOnboardingRedirect } from "@/lib/onboarding/redirects";

export default async function OnboardingPage() {
  const authentication = await getAuthenticatedUser();
  if (!authentication.ok) {
    redirect(
      getOnboardingRedirect({
        isAuthenticated: false,
        hasConnectedAccount: false,
      }) ?? "/login",
    );
  }

  const connectedAccount = await db.socialAccount.findFirst({
    where: { userId: authentication.userId },
    select: { id: true },
  });

  const destination = getOnboardingRedirect({
    isAuthenticated: true,
    hasConnectedAccount: connectedAccount !== null,
  });

  if (destination) {
    redirect(destination);
  }

  const user = await db.user.findUnique({
    where: { id: authentication.userId },
    select: { timezone: true },
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-4 py-12 sm:px-6">
      <OnboardingTimezoneSync currentTimezone={user?.timezone ?? "UTC"} />
      <div className="mb-10 flex flex-col items-center gap-4 text-center sm:mb-12">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Getting started
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Connect your first account
        </h1>
      </div>
      <OnboardingAccountList />
    </main>
  );
}
