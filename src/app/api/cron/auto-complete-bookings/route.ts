import { NextResponse } from "next/server";

import { captureServerException } from "@/lib/posthog/server";
import { autoCompletePastBookings } from "@/server/jobs/auto-complete-bookings";
import { requireCronAuthAndRun } from "@/server/security/cron-auth";
import { flushPosthogLogsAfterResponse } from "@/src/instrumentation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JOB_NAME = "auto-complete-bookings";
const MAX_LIMIT = 200;
const MAX_WINDOW_MINUTES = 180;

function parseOptionalInt(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(request: Request) {
  await flushPosthogLogsAfterResponse();
  return requireCronAuthAndRun(request, JOB_NAME, async (auth) => {
    const url = new URL(request.url);
    const dryRun = ["1", "true", "yes"].includes(
      (url.searchParams.get("dryRun") ?? "").toLowerCase(),
    );
    const requestedLimit = parseOptionalInt(url.searchParams.get("limit"));
    const requestedWindowMinutes = parseOptionalInt(url.searchParams.get("windowMinutes"));
    const limit = requestedLimit ? Math.min(requestedLimit, MAX_LIMIT) : undefined;
    const windowMinutes = requestedWindowMinutes
      ? Math.min(requestedWindowMinutes, MAX_WINDOW_MINUTES)
      : undefined;

    try {
      const summary = await autoCompletePastBookings({ dryRun, limit, windowMinutes });
      return NextResponse.json({ success: true, runId: auth.runId, ...summary });
    } catch (error) {
      console.error("[cron][auto-complete] failed to run", {
        jobName: auth.jobName,
        runId: auth.runId,
        error,
      });
      captureServerException(error, {
        properties: { jobName: auth.jobName, runId: auth.runId, source: "cron" },
      });
      return NextResponse.json({ error: "Auto-complete cron failed." }, { status: 500 });
    }
  });
}
