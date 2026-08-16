function parseDateTimeParts(
  formatter: Intl.DateTimeFormat,
  date: Date,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = formatter.formatToParts(date);
  const get = (type: string): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return value ? parseInt(value, 10) : 0;
  };

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const utcFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const tzFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const utcParts = parseDateTimeParts(utcFormatter, date);
  const tzParts = parseDateTimeParts(tzFormatter, date);

  const utcTimestamp = Date.UTC(
    utcParts.year,
    utcParts.month - 1,
    utcParts.day,
    utcParts.hour,
    utcParts.minute,
    utcParts.second,
  );
  const tzTimestamp = Date.UTC(
    tzParts.year,
    tzParts.month - 1,
    tzParts.day,
    tzParts.hour,
    tzParts.minute,
    tzParts.second,
  );

  return (tzTimestamp - utcTimestamp) / 60000;
}

export interface LocalDateTime {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

export function utcToLocalDateTime(
  date: Date,
  timeZone: string,
): LocalDateTime {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    date: `${get("year")}-${get("month").padStart(2, "0")}-${get("day").padStart(2, "0")}`,
    time: `${get("hour").padStart(2, "0")}:${get("minute").padStart(2, "0")}`,
  };
}

export function localDateTimeToUtc(
  local: LocalDateTime,
  timeZone: string,
): Date {
  const [year, month, day] = local.date.split("-").map(Number);
  const [hour, minute] = local.time.split(":").map(Number);
  const localTimestamp = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
    0,
  );

  let candidate = new Date(localTimestamp);
  for (let index = 0; index < 3; index += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(candidate, timeZone);
    candidate = new Date(localTimestamp - offsetMinutes * 60000);
  }

  return candidate;
}

export function generateScheduleTimeOptions(): string[] {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      options.push(
        `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      );
    }
  }
  return options;
}

export function nextScheduleSlot(
  from: Date,
  timeZone: string,
): LocalDateTime {
  const local = utcToLocalDateTime(from, timeZone);
  let [hour, minute] = local.time.split(":").map(Number);

  if (minute > 30) {
    minute = 0;
    hour += 1;
  } else if (minute > 0) {
    minute = 30;
  } else {
    minute = 0;
  }

  const next = localDateTimeToUtc(
    {
      date: local.date,
      time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    },
    timeZone,
  );

  if (next.getTime() <= from.getTime()) {
    return nextScheduleSlot(new Date(from.getTime() + 30 * 60 * 1000), timeZone);
  }

  return utcToLocalDateTime(next, timeZone);
}

export function tomorrowAt(
  hour: number,
  minute: number,
  timeZone: string,
): LocalDateTime {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const local = utcToLocalDateTime(tomorrow, timeZone);
  return {
    date: local.date,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}
