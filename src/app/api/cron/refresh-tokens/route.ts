import { NextResponse } from "next/server";
import {
  isCronRefreshAuthorized,
  refreshMetaTokens,
} from "@/lib/cron/refresh-tokens";

export async function POST(request: Request): Promise<NextResponse> {
  if (!isCronRefreshAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshMetaTokens();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
