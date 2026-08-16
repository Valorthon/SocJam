import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publishDueScheduledTargets } from "@/lib/posts/scheduler";

export const dynamic = "force-dynamic";

function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET;
}

function isAuthorized(request: Request): boolean {
  const expected = getCronSecret();
  if (!expected) return false;

  const header = request.headers.get("authorization");
  if (!header) return false;

  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token === expected;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await publishDueScheduledTargets({ db });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Scheduled publishing cron failed.", error);
    return NextResponse.json(
      { error: "Unable to publish scheduled posts." },
      { status: 500 },
    );
  }
}
