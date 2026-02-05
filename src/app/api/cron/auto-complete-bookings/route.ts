import { NextResponse } from "next/server";

import { autoCompletePastBookings } from "@/server/jobs/auto-complete-bookings";

const CRON_SECRET = process.env.CRON_SECRET;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseOptionalInt(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const hasValidBearerToken = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;

  if (CRON_SECRET && !hasValidBearerToken) {
    console.warn("[cron][auto-complete] Unauthorized request", {
      hasAuthHeader: !!authHeader,
      hasCronSecret: !!CRON_SECRET,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!CRON_SECRET) {
    console.warn("[cron][auto-complete] CRON_SECRET not set - endpoint is unprotected");
  }

  const url = new URL(request.url);
  const dryRun = ["1", "true", "yes"].includes((url.searchParams.get("dryRun") ?? "").toLowerCase());
  const limit = parseOptionalInt(url.searchParams.get("limit"));
  const windowMinutes = parseOptionalInt(url.searchParams.get("windowMinutes"));

  try {
    const summary = await autoCompletePastBookings({ dryRun, limit, windowMinutes });
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("[cron][auto-complete] failed to run", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
