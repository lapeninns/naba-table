import { NextResponse } from "next/server";

import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

type DisabledTable = {
  id: string;
  table_number: string | null;
  status: string | null;
  active: boolean | null;
  zone_id: string | null;
  zones?: { id: string | null; name: string | null; active: boolean | null } | null;
};

type DisabledAssignment = {
  booking_id: string | null;
  table_id: string | null;
  start_at: string | null;
  end_at: string | null;
  bookings?: {
    id: string;
    restaurant_id: string | null;
    booking_date: string | null;
    start_time: string | null;
    end_time: string | null;
    start_at: string | null;
    end_at: string | null;
    party_size: number | null;
    status: string | null;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
  } | null;
};

function toBookingKey(assignment: DisabledAssignment): string | null {
  return assignment.booking_id && typeof assignment.booking_id === "string" && assignment.booking_id.length > 0
    ? assignment.booking_id
    : assignment.bookings?.id ?? null;
}

export async function GET(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const restaurantIdParam = req.nextUrl.searchParams.get("restaurantId");

  // Resolve membership(s)
  const { data: memberships, error: membershipError } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id")
    .eq("user_id", user.id);

  if (membershipError) {
    return NextResponse.json({ error: "Unable to verify memberships" }, { status: 500 });
  }

  const membershipIds = (memberships ?? [])
    .map((row) => row.restaurant_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  let restaurantId = restaurantIdParam ?? null;
  if (restaurantId && !membershipIds.includes(restaurantId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!restaurantId) {
    restaurantId = membershipIds[0] ?? null;
  }

  if (!restaurantId) {
    return NextResponse.json({ error: "No restaurants available" }, { status: 400 });
  }

  const serviceSupabase = getServiceSupabaseClient();

  // 1) Find disabled tables (inactive table, out_of_service status, or disabled zone)
  const { data: disabledTables, error: disabledError } = await serviceSupabase
    .from("table_inventory")
    .select("id, table_number, status, active, zone_id, zones(id, name, active)")
    .eq("restaurant_id", restaurantId)
    .or("active.is.false,status.eq.out_of_service,zones.active.is.false");

  if (disabledError) {
    return NextResponse.json({ error: "Failed to load disabled tables" }, { status: 500 });
  }

  const disabledTableList = (disabledTables ?? []) as DisabledTable[];
  const disabledIds = disabledTableList.map((row) => row.id).filter((id): id is string => Boolean(id));

  if (disabledIds.length === 0) {
    return NextResponse.json({ restaurantId, disabledTableCount: 0, bookings: [] });
  }

  // 2) Fetch bookings that use those tables
  const { data: assignmentRows, error: assignmentError } = await serviceSupabase
    .from("booking_table_assignments")
    .select(
      `booking_id, table_id, start_at, end_at, bookings(id, restaurant_id, booking_date, start_time, end_time, start_at, end_at, party_size, status, customer_name, customer_email, customer_phone)`
    )
    .in("table_id", disabledIds)
    .order("start_at", { ascending: true });

  if (assignmentError) {
    return NextResponse.json({ error: "Failed to load assignments" }, { status: 500 });
  }

  const assignments = (assignmentRows ?? []) as DisabledAssignment[];

  const tableMeta = new Map<string, DisabledTable>();
  for (const row of disabledTableList) {
    if (row.id) tableMeta.set(row.id, row);
  }

  const bookingMap = new Map<
    string,
    {
      id: string;
      status: string | null;
      partySize: number | null;
      startIso: string | null;
      endIso: string | null;
      customerName: string | null;
      customerEmail: string | null;
      customerPhone: string | null;
      assignments: Array<{
        tableId: string;
        tableNumber: string | null;
        tableStatus: string | null;
        tableActive: boolean | null;
        zoneId: string | null;
        zoneName: string | null;
        zoneActive: boolean | null;
        startAt: string | null;
        endAt: string | null;
      }>;
    }
  >();

  for (const row of assignments) {
    const bookingId = toBookingKey(row);
    if (!bookingId || !row.bookings) continue;
    if (row.bookings.restaurant_id !== restaurantId) continue;

    const tableId = row.table_id ?? undefined;
    const table = tableId ? tableMeta.get(tableId) : undefined;
    const record = bookingMap.get(bookingId) ?? {
      id: bookingId,
      status: row.bookings.status ?? null,
      partySize: row.bookings.party_size ?? null,
      startIso: row.bookings.start_at ?? null,
      endIso: row.bookings.end_at ?? null,
      customerName: row.bookings.customer_name ?? null,
      customerEmail: row.bookings.customer_email ?? null,
      customerPhone: row.bookings.customer_phone ?? null,
      assignments: [],
    };

    record.assignments.push({
      tableId: tableId ?? "",
      tableNumber: table?.table_number ?? null,
      tableStatus: table?.status ?? null,
      tableActive: table?.active ?? null,
      zoneId: table?.zone_id ?? null,
      zoneName: table?.zones?.name ?? null,
      zoneActive: table?.zones?.active ?? null,
      startAt: row.start_at ?? null,
      endAt: row.end_at ?? null,
    });

    bookingMap.set(bookingId, record);
  }

  const bookings = Array.from(bookingMap.values()).sort((a, b) => {
    if (a.startIso && b.startIso) return a.startIso.localeCompare(b.startIso);
    return a.id.localeCompare(b.id);
  });

  return NextResponse.json({
    restaurantId,
    disabledTableCount: disabledIds.length,
    bookings,
  });
}
