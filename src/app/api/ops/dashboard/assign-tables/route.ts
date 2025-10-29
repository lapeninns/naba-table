import { NextResponse } from "next/server";
import { z } from "zod";

import { autoAssignTablesForDate } from "@/server/capacity";
import { ServiceNotFoundError } from "@/server/capacity/policy";
import { getTodayBookingsSummary } from "@/server/ops/bookings";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireMembershipForRestaurant } from "@/server/team/access";

import type { NextRequest} from "next/server";

const autoAssignSchema = z.object({
  restaurantId: z.string().uuid(),
  date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional()
    .nullable(),
});

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = autoAssignSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { restaurantId } = parsed.data;
  let targetDate = parsed.data.date ?? null;

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[ops][dashboard][assign-tables] auth error", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    await requireMembershipForRestaurant({ userId: user.id, restaurantId });
  } catch (accessError) {
    console.error("[ops][dashboard][assign-tables] access denied", accessError);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceClient = getServiceSupabaseClient();

  if (!targetDate) {
    try {
      const summary = await getTodayBookingsSummary(restaurantId, {
        client: serviceClient,
      });
      targetDate = summary.date;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to resolve service date";
      console.error("[ops][dashboard][assign-tables] failed to resolve date", message);
      return NextResponse.json({ error: "Unable to resolve service date" }, { status: 500 });
    }
  }

  if (!targetDate) {
    return NextResponse.json({ error: "Service date could not be determined" }, { status: 500 });
  }

  try {
    const result = await autoAssignTablesForDate({
      restaurantId,
      date: targetDate,
      assignedBy: user.id,
      client: serviceClient,
    });

    return NextResponse.json({ date: targetDate, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to auto-assign tables";
    console.error("[ops][dashboard][assign-tables] failure", message);
    if (error instanceof ServiceNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
