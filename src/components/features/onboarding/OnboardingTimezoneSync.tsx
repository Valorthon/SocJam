"use client";

import { useEffect } from "react";

import { updateUserTimezone } from "@/app/(app)/settings/actions";

interface OnboardingTimezoneSyncProps {
  currentTimezone: string;
}

export function OnboardingTimezoneSync({
  currentTimezone,
}: OnboardingTimezoneSyncProps) {
  useEffect(() => {
    if (currentTimezone !== "UTC") return;

    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && detected !== currentTimezone) {
      void updateUserTimezone(detected);
    }
  }, [currentTimezone]);

  return null;
}
