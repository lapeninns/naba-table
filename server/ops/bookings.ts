import type { SupabaseClient } from "@supabase/supabase-js";

import { getDateInTimezone } from "@/lib/utils/datetime";
import type { Database, Tables } from "@/types/supabase";
import { getServiceSupabaseClient } from "@/server/supabase";

type DbClient = SupabaseClient<Database, "public", any>;

const CANCELLED_STATUSES: Tables<"bookings">["status"][] = ["cancelled", "no_show"];

export type TodayBooking = {
  id: string;
  status: Tables<"bookings">["status"];
  startTime: string | null;
  endTime: string | null;
  partySize: number;
  customerName: string;
  notes: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  reference: string | null;
  details: Tables<"bookings">["details"] | null;
  source: Tables<"bookings">["source"] | null;
};

export type TodayBookingsSummary = {
  date: string;
  timezone: string;
  restaurantId: string;
  totals: {
    total: number;
    confirmed: number;
    completed: number;
    pending: number;
    cancelled: number;
    noShow: number;
    upcoming: number;
    covers: number;
  };
  bookings: TodayBooking[];
};

type SummaryOptions = {
  client?: DbClient;
  referenceDate?: Date;
  targetDate?: string;
};

function resolveTimezone(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "UTC";
}

function isValidDateString(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function getTodayBookingsSummary(
  restaurantId: string,
  options: SummaryOptions = {},
): Promise<TodayBookingsSummary> {
  const client = options.client ?? getServiceSupabaseClient();
  const referenceDate = options.referenceDate ?? new Date();

  const { data: restaurant, error: restaurantError } = await client
    .from("restaurants")
    .select("id, timezone")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restaurantError) {
    throw restaurantError;
  }

  const timezone = resolveTimezone(restaurant?.timezone);
  const reportDate = isValidDateString(options.targetDate)
    ? options.targetDate
    : getDateInTimezone(referenceDate, timezone);

  const { data, error } = await client
    .from("bookings")
    .select(
      "id, status, start_time, end_time, party_size, customer_name, customer_email, customer_phone, notes, reference, details, source",
    )
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", reportDate)
    .order("start_time", { ascending: true });

  if (error) {
    throw error;
  }

  const bookings = (data ?? []) as Tables<"bookings">[];

  const summaryBookings: TodayBooking[] = bookings.map((booking) => ({
    id: booking.id,
    status: booking.status,
    startTime: booking.start_time,
    endTime: booking.end_time,
    partySize: booking.party_size,
    customerName: booking.customer_name,
    notes: booking.notes ?? null,
    customerEmail: booking.customer_email ?? null,
    customerPhone: booking.customer_phone ?? null,
    reference: booking.reference ?? null,
    details: (booking.details as Tables<"bookings">["details"]) ?? null,
    source: (booking.source as Tables<"bookings">["source"]) ?? null,
  }));

  const totals = summaryBookings.reduce(
    (acc, booking) => {
      acc.total += 1;

      switch (booking.status) {
        case "pending":
        case "pending_allocation":
          acc.pending += 1;
          acc.upcoming += 1;
          break;
        case "confirmed":
          acc.confirmed += 1;
          acc.upcoming += 1;
          break;
        case "completed":
          acc.confirmed += 1;
          acc.completed += 1;
          break;
        case "cancelled":
          acc.cancelled += 1;
          break;
        case "no_show":
          acc.noShow += 1;
          break;
        default:
          break;
      }

      if (!CANCELLED_STATUSES.includes(booking.status)) {
        acc.covers += booking.partySize;
      }

      return acc;
    },
    {
      total: 0,
      confirmed: 0,
      completed: 0,
      pending: 0,
      cancelled: 0,
      noShow: 0,
      upcoming: 0,
      covers: 0,
    },
  );

  return {
    date: reportDate,
    timezone,
    restaurantId,
    totals,
    bookings: summaryBookings,
  };
}

export type BookingHeatmap = Record<
  string,
  {
    covers: number;
    bookings: number;
  }
>;

type HeatmapOptions = {
  startDate: string;
  endDate: string;
  client?: DbClient;
};

export async function getBookingsHeatmap(
  restaurantId: string,
  options: HeatmapOptions,
): Promise<BookingHeatmap> {
  const client = options.client ?? getServiceSupabaseClient();

  const { data, error } = await client
    .from("bookings")
    .select("booking_date, party_size, status")
    .eq("restaurant_id", restaurantId)
    .gte("booking_date", options.startDate)
    .lte("booking_date", options.endDate);

  if (error) {
    throw error;
  }

  const entries = (data ?? []) as Pick<Tables<"bookings">, "booking_date" | "party_size" | "status">[];

  return entries.reduce<BookingHeatmap>((acc, booking) => {
    const key = booking.booking_date;
    if (!acc[key]) {
      acc[key] = { covers: 0, bookings: 0 };
    }

    acc[key]!.bookings += 1;
    if (!CANCELLED_STATUSES.includes(booking.status)) {
      acc[key]!.covers += booking.party_size ?? 0;
    }

    return acc;
  }, {});
}
