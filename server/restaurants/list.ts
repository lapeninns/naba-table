import type { SupabaseClient } from '@supabase/supabase-js';

import { getServiceSupabaseClient } from '@/server/supabase';
import type { Database } from '@/types/supabase';

type DbClient = SupabaseClient<Database, 'public', any>;

export type RestaurantListItem = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  bookingPolicy: string | null;
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  createdAt: string;
  updatedAt: string;
  role: 'owner' | 'admin' | 'staff' | 'viewer';
};

export type ListRestaurantsForOpsFilters = {
  userId: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: 'name' | 'created_at';
};

export type ListRestaurantsForOpsResult = {
  restaurants: RestaurantListItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
};

export async function listRestaurantsForOps(
  filters: ListRestaurantsForOpsFilters,
  client: DbClient = getServiceSupabaseClient(),
): Promise<ListRestaurantsForOpsResult> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const sort = filters.sort ?? 'name';
  const search = filters.search?.trim();

  const offset = (page - 1) * pageSize;
  const limit = pageSize;

  let query = client
    .from('restaurants')
    .select(
      `
      id,
      name,
      slug,
      timezone,
      capacity,
      contact_email,
      contact_phone,
      address,
      booking_policy,
      reservation_interval_minutes,
      reservation_default_duration_minutes,
      reservation_last_seating_buffer_minutes,
      created_at,
      updated_at,
      restaurant_memberships!inner(
        role
      )
    `,
      { count: 'exact' },
    )
    .eq('restaurant_memberships.user_id', filters.userId);

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  if (sort === 'name') {
    query = query.order('name', { ascending: true });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[listRestaurantsForOps] Query failed', error);
    throw new Error(`Failed to list restaurants: ${error.message}`);
  }

  const total = count ?? 0;
  const hasNext = offset + limit < total;

  const restaurants: RestaurantListItem[] = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    capacity: row.capacity,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    address: row.address,
    bookingPolicy: row.booking_policy,
    reservationIntervalMinutes: row.reservation_interval_minutes,
    reservationDefaultDurationMinutes: row.reservation_default_duration_minutes,
    reservationLastSeatingBufferMinutes: row.reservation_last_seating_buffer_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    role: row.restaurant_memberships[0]?.role ?? 'viewer',
  }));

  return {
    restaurants,
    page,
    pageSize,
    total,
    hasNext,
  };
}
