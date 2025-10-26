import { NextResponse } from "next/server";
import { z } from "zod";

import { generateCSV } from "@/lib/export/csv";
import { getAllCustomersWithProfiles, type CustomerWithProfile } from "@/server/ops/customers";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { fetchUserMemberships } from "@/server/team/access";

import type { NextRequest} from "next/server";

const exportQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  sort: z.enum(["asc", "desc"]).default("desc").optional(),
});

function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Never";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

const CUSTOMER_EXPORT_COLUMNS: {
  header: string;
  accessor: (row: CustomerWithProfile) => unknown;
}[] = [
  { header: "Name", accessor: (row: CustomerWithProfile) => row.name },
  { header: "Email", accessor: (row: CustomerWithProfile) => row.email },
  { header: "Phone", accessor: (row: CustomerWithProfile) => row.phone },
  { header: "Total Bookings", accessor: (row: CustomerWithProfile) => row.totalBookings },
  { header: "Total Covers", accessor: (row: CustomerWithProfile) => row.totalCovers },
  { header: "Total Cancellations", accessor: (row: CustomerWithProfile) => row.totalCancellations },
  { header: "First Booking", accessor: (row: CustomerWithProfile) => formatDate(row.firstBookingAt) },
  { header: "Last Booking", accessor: (row: CustomerWithProfile) => formatDate(row.lastBookingAt) },
  { header: "Marketing Opt-in", accessor: (row: CustomerWithProfile) => formatBoolean(row.marketingOptIn) },
];

function buildFilename(restaurantName: string | null | undefined): string {
  const baseName = restaurantName?.trim().toLowerCase() ?? "restaurant";
  const safeName = baseName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "restaurant";
  const date = new Date().toISOString().split("T")[0];
  return `customers-${safeName}-${date}.csv`;
}

export async function GET(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[ops/customers/export][GET] failed to resolve auth", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const rawParams = {
    restaurantId: req.nextUrl.searchParams.get("restaurantId"),
    sort: req.nextUrl.searchParams.get("sort") ?? undefined,
  };

  const parsed = exportQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const params = parsed.data;

  let memberships;
  try {
    memberships = await fetchUserMemberships(user.id, supabase);
  } catch (error) {
    console.error("[ops/customers/export][GET] membership lookup failed", error);
    return NextResponse.json({ error: "Unable to verify memberships" }, { status: 500 });
  }

  const membership = memberships.find((item) => item.restaurant_id === params.restaurantId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const serviceSupabase = getServiceSupabaseClient();

  let customers: CustomerWithProfile[];
  try {
    customers = await getAllCustomersWithProfiles({
      restaurantId: params.restaurantId,
      sortOrder: params.sort ?? "desc",
      client: serviceSupabase,
    });
  } catch (error) {
    console.error("[ops/customers/export][GET] query failed", error);
    return NextResponse.json({ error: "Unable to export customers" }, { status: 500 });
  }

  const csv = generateCSV(customers, CUSTOMER_EXPORT_COLUMNS);
  const withBom = `\uFEFF${csv}`;
  const filename = buildFilename(membership.restaurants?.name);

  return new NextResponse(withBom, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
