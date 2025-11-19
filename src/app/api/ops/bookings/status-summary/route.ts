import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getBookingStatusSummary } from "@/server/ops/booking-lifecycle/summary";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import { fetchUserMemberships } from "@/server/team/access";

import type { BookingStatus } from "@/server/ops/booking-lifecycle/stateMachine";

const bookingStatusSchema = z.enum([
  "pending",
  "pending_allocation",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
  "PRIORITY_WAITLIST",
]);

const querySchema = z.object({
  restaurantId: z.string().uuid(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be ISO-8601 date (YYYY-MM-DD)")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be ISO-8601 date (YYYY-MM-DD)")
    .optional(),
  statuses: z.string().optional(),
});

type QueryParams = z.infer<typeof querySchema>;

function parseQuery(request: NextRequest): QueryParams {
  const searchParams = request.nextUrl.searchParams;
  return querySchema.parse({
    restaurantId: searchParams.get("restaurantId"),
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    statuses: searchParams.get("statuses") ?? undefined,
  });
}

export async function GET(request: NextRequest) {
  let params: QueryParams;
  try {
    params = parseQuery(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid query parameters", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const normalisedStatuses = params.statuses
    ? params.statuses
      .split(",")
      .map((status) => status.trim())
      .filter((status) => status.length > 0)
    : [];

  for (const status of normalisedStatuses) {
    const result = bookingStatusSchema.safeParse(status);
    if (!result.success) {
      return NextResponse.json({ error: `Invalid status filter: ${status}` }, { status: 400 });
    }
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[ops][booking-status-summary] auth lookup failed", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 401 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const memberships = await fetchUserMemberships(user.id, supabase);
    const hasAccess = memberships.some((membership) => membership.restaurant_id === params.restaurantId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (error) {
    console.error("[ops][booking-status-summary] membership lookup failed", error);
    return NextResponse.json({ error: "Unable to verify permissions" }, { status: 500 });
  }

  try {
    const summaryRows = await getBookingStatusSummary({
      restaurantId: params.restaurantId,
      startDate: params.from ?? null,
      endDate: params.to ?? null,
      statuses: normalisedStatuses.length > 0 ? (normalisedStatuses as BookingStatus[]) : null,
    });

    const totals: Record<BookingStatus, number> = {
      pending: 0,
      pending_allocation: 0,
      confirmed: 0,
      checked_in: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
      PRIORITY_WAITLIST: 0,
    };

    for (const row of summaryRows) {
      totals[row.status] = Number(row.total);
    }

    return NextResponse.json({
      restaurantId: params.restaurantId,
      range: {
        from: params.from ?? null,
        to: params.to ?? null,
      },
      filter: {
        statuses: normalisedStatuses.length > 0 ? (normalisedStatuses as BookingStatus[]) : null,
      },
      totals,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ops][booking-status-summary] failed to compute summary", error);
    return NextResponse.json({ error: "Unable to compute booking status summary" }, { status: 500 });
  }
}
