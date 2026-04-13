import { NextResponse } from "next/server";
import { z } from "zod";

import { getTodayBookingsSummary } from "@/server/ops/bookings";
import { getServiceSupabaseClient } from "@/server/supabase";
import { buildDashboardAccessErrorResponse, requireDashboardAccess } from "@/src/app/api/ops/dashboard/_shared";

import type { NextRequest} from "next/server";

const summaryQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional(),
});

type SummaryQuery = z.infer<typeof summaryQuerySchema>;

function parseQuery(request: NextRequest): SummaryQuery | null {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = summaryQuerySchema.safeParse(entries);
  if (!result.success) {
    return null;
  }
  return result.data;
}

export async function GET(request: NextRequest) {
  const query = parseQuery(request);
  if (!query) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    await requireDashboardAccess(query.restaurantId);
  } catch (error) {
    return buildDashboardAccessErrorResponse("summary", error);
  }

  try {
    const summary = await getTodayBookingsSummary(query.restaurantId, {
      client: getServiceSupabaseClient(),
      targetDate: query.date ?? undefined,
    });

    return NextResponse.json(summary);
  } catch (summaryError) {
    console.error("[ops/dashboard][summary] failed to load summary", summaryError);
    return NextResponse.json({ error: "Unable to load summary" }, { status: 500 });
  }
}
