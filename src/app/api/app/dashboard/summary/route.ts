import { NextResponse } from "next/server";
import { z } from "zod";

import { getTodayBookingsSummary } from "@/server/ops/bookings";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireMembershipForRestaurant } from "@/server/team/access";

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

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops/dashboard][summary] failed to resolve auth", error.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: query.restaurantId });
  } catch (membershipError) {
    console.error("[ops/dashboard][summary] membership validation failed", membershipError);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
