import { getServiceSupabaseClient } from '@/server/supabase';

import type { BookingStatus } from './stateMachine';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database, 'public'>;

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

const DEFAULT_BOOKING_STATUSES: readonly BookingStatus[] = [
  'pending',
  'pending_allocation',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
  'PRIORITY_WAITLIST',
];

export async function getBookingStatusSummary(
  filters: BookingStatusSummaryFilters,
): Promise<BookingStatusSummaryRow[]> {
  const client = filters.client ?? getServiceSupabaseClient();
  const statuses =
    filters.statuses && filters.statuses.length > 0 ? filters.statuses : DEFAULT_BOOKING_STATUSES;

  const rows = await Promise.all(
    statuses.map(async (status) => {
      let query = client
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', filters.restaurantId)
        .eq('status', status);

      if (filters.startDate) {
        query = query.gte('booking_date', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('booking_date', filters.endDate);
      }

      const { count, error } = await query;

      if (error) {
        throw error;
      }

      return { status, total: count ?? 0 };
    }),
  );

  return rows;
}
