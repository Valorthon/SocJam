import assert from "node:assert/strict";
import {
  isAlignedToScheduleInterval,
  validateScheduledAt,
} from "@/lib/validations/schedule";

async function run(): Promise<void> {
  const now = new Date("2026-06-01T12:00:00.000Z");

  assert.equal(
    validateScheduledAt(
      new Date("2026-06-01T13:00:00.000Z"),
      "UTC",
      now,
    ).valid,
    true,
  );
  assert.equal(
    validateScheduledAt(
      new Date("2026-06-01T13:30:00.000Z"),
      "UTC",
      now,
    ).valid,
    true,
  );

  const past = validateScheduledAt(
    new Date("2026-06-01T11:00:00.000Z"),
    "UTC",
    now,
  );
  assert.equal(past.valid, false);
  assert.equal(past.error, "Scheduled time must be in the future.");

  const wrongMinute = validateScheduledAt(
    new Date("2026-06-01T13:15:00.000Z"),
    "UTC",
    now,
  );
  assert.equal(wrongMinute.valid, false);

  const withMilliseconds = validateScheduledAt(
    new Date("2026-06-01T13:00:00.123Z"),
    "UTC",
    now,
  );
  assert.equal(withMilliseconds.valid, false);

  assert.equal(
    isAlignedToScheduleInterval(
      new Date("2026-06-01T09:30:00.000Z"),
      "America/New_York",
    ),
    true,
  );

  console.log("Schedule validation tests passed.");
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
