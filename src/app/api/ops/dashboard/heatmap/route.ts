import { NextResponse } from "next/server";
import { z } from "zod";

import { getBookingsHeatmap } from "@/server/ops/bookings";
import { getServiceSupabaseClient } from "@/server/supabase";
import { buildDashboardAccessErrorResponse, requireDashboardAccess } from "@/src/app/api/ops/dashboard/_shared";

import type { NextRequest} from "next/server";

const heatmapQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  startDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  endDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
});

type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;

function parseQuery(request: NextRequest): HeatmapQuery | null {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = heatmapQuerySchema.safeParse(entries);
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
    return buildDashboardAccessErrorResponse("heatmap", error);
  }

  try {
    const heatmap = await getBookingsHeatmap(query.restaurantId, {
      client: getServiceSupabaseClient(),
      startDate: query.startDate,
      endDate: query.endDate,
    });

    return NextResponse.json(heatmap);
  } catch (heatmapError) {
    console.error("[ops/dashboard][heatmap] failed to load heatmap", heatmapError);
    return NextResponse.json({ error: "Unable to load heatmap" }, { status: 500 });
  }
}
