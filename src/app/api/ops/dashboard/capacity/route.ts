import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { calculateCapacityUtilization } from "@/server/ops/capacity";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireMembershipForRestaurant } from "@/server/team/access";

const capacityQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional(),
});

type CapacityQuery = z.infer<typeof capacityQuerySchema>;

function parseQuery(request: NextRequest): CapacityQuery | null {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = capacityQuerySchema.safeParse(entries);
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
    console.error("[ops/dashboard][capacity] failed to resolve auth", error.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId: query.restaurantId });
  } catch (membershipError) {
    console.error("[ops/dashboard][capacity] membership validation failed", membershipError);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!query.date) {
    return NextResponse.json({ error: "Date parameter is required" }, { status: 400 });
  }

  try {
    const capacityData = await calculateCapacityUtilization(query.restaurantId, query.date, getServiceSupabaseClient());

    return NextResponse.json(capacityData);
  } catch (capacityError) {
    console.error("[ops/dashboard][capacity] failed to calculate capacity", capacityError);
    return NextResponse.json({ error: "Unable to load capacity data" }, { status: 500 });
  }
}
