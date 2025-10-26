import { NextResponse } from "next/server";
import { z } from "zod";

import { getTodayBookingChanges } from "@/server/ops/bookings";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireMembershipForRestaurant } from "@/server/team/access";

import type { NextRequest} from "next/server";

const changesQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

type ChangesQuery = z.infer<typeof changesQuerySchema>;

function parseQuery(request: NextRequest): ChangesQuery | null {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = changesQuerySchema.safeParse(entries);
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
    console.error("[ops/dashboard][changes] failed to resolve auth", error.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: query.restaurantId });
  } catch (membershipError) {
    console.error("[ops/dashboard][changes] membership validation failed", membershipError);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!query.date) {
    return NextResponse.json({ error: "Date parameter is required" }, { status: 400 });
  }

  try {
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const changesData = await getTodayBookingChanges(query.restaurantId, {
      date: query.date,
      limit,
      client: getServiceSupabaseClient(),
    });

    return NextResponse.json(changesData);
  } catch (changesError) {
    console.error("[ops/dashboard][changes] failed to load booking changes", changesError);
    return NextResponse.json({ error: "Unable to load booking changes" }, { status: 500 });
  }
}
