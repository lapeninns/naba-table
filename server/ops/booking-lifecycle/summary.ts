
import { getServiceSupabaseClient } from "@/server/supabase";

import type { BookingStatus } from "./stateMachine";
import type { Database, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public", any>;

export type BookingStatusSummaryRow = {
  status: BookingStatus;
  total: number;
};

export type BookingStatusSummaryFilters = {
  restaurantId: string;
  startDate?: string | null;
  endDate?: string | null;
  statuses?: BookingStatus[] | null;
  client?: DbClient;
};

export async function getBookingStatusSummary(filters: BookingStatusSummaryFilters): Promise<BookingStatusSummaryRow[]> {
  const client = filters.client ?? getServiceSupabaseClient();
  let query = client
    .from("bookings")
    .select("status")
    .eq("restaurant_id", filters.restaurantId);

  if (filters.startDate) {
    query = query.gte("booking_date", filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte("booking_date", filters.endDate);
  }

  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in("status", filters.statuses);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const counts = new Map<BookingStatus, number>();
  for (const row of (data ?? []) as Pick<Tables<"bookings">, "status">[]) {
    const status = row.status as BookingStatus;
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([status, total]) => ({ status, total }));
}
