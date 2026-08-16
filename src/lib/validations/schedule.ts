export const SCHEDULE_INTERVAL_MINUTES = 30;
export const MISSED_WINDOW_MS = 60 * 60 * 1000;

function getTimeParts(
  date: Date,
  timezone: string,
): { hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return value ? parseInt(value, 10) : 0;
  };

  return {
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
  };
}

export function isAlignedToScheduleInterval(
  date: Date,
  timezone: string,
): boolean {
  if (date.getMilliseconds() !== 0) {
    return false;
  }

  const parts = getTimeParts(date, timezone);
  return parts.minute % SCHEDULE_INTERVAL_MINUTES === 0 && parts.second === 0;
}

export function isFutureDate(date: Date, now: Date): boolean {
  return date.getTime() > now.getTime();
}

export function validateScheduledAt(
  scheduledAt: Date,
  timezone: string,
  now: Date,
): { valid: boolean; error?: string } {
  if (!isFutureDate(scheduledAt, now)) {
    return { valid: false, error: "Scheduled time must be in the future." };
  }

  if (!isAlignedToScheduleInterval(scheduledAt, timezone)) {
    return {
      valid: false,
      error: `Scheduled time must be on a ${SCHEDULE_INTERVAL_MINUTES}-minute interval.`,
    };
  }

  return { valid: true };
}
