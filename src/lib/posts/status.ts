import type { PostStatus, TargetStatus } from "@prisma/client";

export function derivePostStatus(
  targets: ReadonlyArray<{ status: TargetStatus }>,
): PostStatus {
  if (targets.some((target) => target.status === "PUBLISHING")) return "PUBLISHING";
  if (targets.some((target) => target.status === "DRAFT")) return "DRAFT";
  if (targets.some((target) => target.status === "SCHEDULED")) return "SCHEDULED";
  if (targets.length > 0 && targets.every((target) => target.status === "PUBLISHED")) return "PUBLISHED";
  if (targets.some((target) => target.status === "PUBLISHED")) return "PARTIALLY_FAILED";
  if (targets.length > 0) return "FAILED";
  return "DRAFT";
}
