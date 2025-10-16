/**
 * Capacity Overbooking Export
 * Story 5: Admins can download overbooking reports for investigation.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { calculateCapacityUtilization } from "@/server/ops/capacity";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

const ADMIN_ROLES = ["owner", "admin"] as const;

const exportQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  from: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  to: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
});

type ExportQuery = z.infer<typeof exportQuerySchema>;

function enumerateDates(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(cursor.toISOString().split("T")[0]!);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function createCsv(rows: Array<Record<string, string | number | null>>): string {
  const headers = [
    "date",
    "service_period",
    "period_start",
    "period_end",
    "booked_covers",
    "max_covers",
    "booked_parties",
    "max_parties",
    "utilization_percent",
    "overbooked_by",
    "booking_ids",
  ];

  const escape = (value: string | number | null) => {
    if (value === null || value === undefined) return "";
    const stringValue = String(value);
    if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const headerRow = headers.join(",");
  const dataRows = rows.map((row) => headers.map((header) => escape(row[header] ?? "")).join(","));

  return [headerRow, ...dataRows].join("\n");
}

export async function GET(request: NextRequest) {
  const parseResult = exportQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );

  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const query: ExportQuery = parseResult.data;
  const dateRange = enumerateDates(query.from, query.to);

  if (dateRange.length === 0) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  if (dateRange.length > 90) {
    return NextResponse.json({ error: "Date range too large (max 90 days)" }, { status: 400 });
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[ops/capacity/export][GET] auth error", authError);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", query.restaurantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    console.error("[ops/capacity/export][GET] membership error", membershipError);
    return NextResponse.json({ error: "Unable to verify permissions" }, { status: 500 });
  }

  if (!membership || !ADMIN_ROLES.includes(membership.role as (typeof ADMIN_ROLES)[number])) {
    return NextResponse.json({ error: "Only owners and admins can export overbooking reports" }, { status: 403 });
  }

  const serviceClient = getServiceSupabaseClient();
  const rows: Array<Record<string, string | number | null>> = [];

  for (const date of dateRange) {
    try {
      const capacitySnapshot = await calculateCapacityUtilization(query.restaurantId, date, serviceClient);
      const overbookedPeriods = capacitySnapshot.periods.filter((period) => period.isOverbooked);

      if (overbookedPeriods.length === 0) {
        continue;
      }

      for (const period of overbookedPeriods) {
        const { data: bookingRows, error: bookingsError } = await serviceClient
          .from("bookings")
          .select("id, party_size, start_time")
          .eq("restaurant_id", query.restaurantId)
          .eq("booking_date", date)
          .in("status", ["pending", "confirmed", "pending_allocation", "completed"])
          .gte("start_time", period.startTime)
          .lt("start_time", period.endTime);

        if (bookingsError) {
          console.error("[ops/capacity/export][GET] bookings query error", bookingsError);
          continue;
        }

        const overbookedBy =
          period.maxCovers !== null && period.bookedCovers !== null
            ? Math.max(period.bookedCovers - period.maxCovers, 0)
            : null;

        rows.push({
          date,
          service_period: period.periodName,
          period_start: period.startTime,
          period_end: period.endTime,
          booked_covers: period.bookedCovers ?? "",
          max_covers: period.maxCovers ?? "",
          booked_parties: period.bookedParties ?? "",
          max_parties: period.maxParties ?? "",
          utilization_percent: period.utilizationPercentage ?? "",
          overbooked_by: overbookedBy ?? "",
          booking_ids: bookingRows?.map((row) => row.id).join(" ") ?? "",
        });
      }
    } catch (error) {
      console.error("[ops/capacity/export][GET] snapshot error", { date, error });
    }
  }

  if (rows.length === 0) {
    rows.push({
      date: query.from,
      service_period: "N/A",
      period_start: "",
      period_end: "",
      booked_covers: "",
      max_covers: "",
      booked_parties: "",
      max_parties: "",
      utilization_percent: "",
      overbooked_by: "",
      booking_ids: "No overbooking incidents found for selected range",
    });
  }

  const csv = createCsv(rows);
  const filename = `capacity-overbooking-${query.restaurantId}-${query.from}-to-${query.to}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
