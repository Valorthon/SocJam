"use client";

import { Button } from "@/components/ui/button";

interface OnboardingErrorProps {
  reset: () => void;
}

export default function OnboardingError({ reset }: OnboardingErrorProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 py-12 text-center sm:px-6">
      <div>
        <h1 className="text-xl font-semibold">Unable to load onboarding</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please try again to connect your first account.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
