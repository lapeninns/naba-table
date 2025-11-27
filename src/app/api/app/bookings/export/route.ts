import { NextResponse } from "next/server";
import { z } from "zod";

import { generateCSV } from "@/lib/export/csv";
import { formatTimeRange } from "@/lib/utils/datetime";
import { getTodayBookingsSummary } from "@/server/ops/bookings";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { requireMembershipForRestaurant } from "@/server/team/access";

import type { NextRequest} from "next/server";

const exportQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional(),
});

type ExportQuery = z.infer<typeof exportQuerySchema>;

function parseQuery(request: NextRequest): ExportQuery | null {
  const entries = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = exportQuerySchema.safeParse(entries);
  if (!result.success) {
    return null;
  }
  return result.data;
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("; ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function buildFilename(restaurantName: string | null | undefined, date: string): string {
  const baseName = restaurantName?.trim().toLowerCase() ?? "restaurant";
  const safeName = baseName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "restaurant";
  return `bookings-${safeName}-${date}.csv`;
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
    console.error("[ops/bookings/export][GET] failed to resolve auth", error.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let membership;
  try {
    membership = await requireMembershipForRestaurant({ userId: user.id, restaurantId: query.restaurantId });
  } catch (membershipError) {
    console.error("[ops/bookings/export][GET] membership validation failed", membershipError);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await getTodayBookingsSummary(query.restaurantId, {
      client: getServiceSupabaseClient(),
      targetDate: query.date ?? undefined,
    });

    const timezone = summary.timezone;

    const csv = generateCSV(summary.bookings, [
      {
        header: "Service Time",
        accessor: (booking) => formatTimeRange(booking.startTime, booking.endTime, timezone),
      },
      { header: "Guest", accessor: (booking) => booking.customerName },
      { header: "Party Size", accessor: (booking) => booking.partySize },
      { header: "Status", accessor: (booking) => booking.status },
      { header: "Email", accessor: (booking) => booking.customerEmail ?? "" },
      { header: "Phone", accessor: (booking) => booking.customerPhone ?? "" },
      { header: "Reference", accessor: (booking) => booking.reference ?? "" },
      { header: "Source", accessor: (booking) => booking.source ?? "" },
      { header: "Loyalty Tier", accessor: (booking) => booking.loyaltyTier ?? "" },
      { header: "Loyalty Points", accessor: (booking) => booking.loyaltyPoints ?? "" },
      { header: "Allergies", accessor: (booking) => normalizeText(booking.allergies) },
      { header: "Dietary Restrictions", accessor: (booking) => normalizeText(booking.dietaryRestrictions) },
      { header: "Seating Preference", accessor: (booking) => booking.seatingPreference ?? "" },
      {
        header: "Marketing Opt-in",
        accessor: (booking) => {
          if (booking.marketingOptIn === true) return "Yes";
          if (booking.marketingOptIn === false) return "No";
          return "";
        },
      },
      { header: "Profile Notes", accessor: (booking) => booking.profileNotes ?? "" },
      { header: "Booking Notes", accessor: (booking) => booking.notes ?? "" },
    ]);

    const withBom = `\uFEFF${csv}`;
    const filename = buildFilename(membership.restaurants?.name, summary.date);

    return new NextResponse(withBom, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (summaryError) {
    console.error("[ops/bookings/export][GET] failed to build export", summaryError);
    return NextResponse.json({ error: "Unable to export bookings" }, { status: 500 });
  }
}
