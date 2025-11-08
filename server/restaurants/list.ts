import { ensureLogoColumnOnRows, isLogoUrlColumnMissing, logLogoColumnFallback } from '@/server/restaurants/logo-url-compat';
import { restaurantSelectColumns } from '@/server/restaurants/select-fields';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database } from '@/types/supabase';
import type { PostgrestResponse, SupabaseClient } from '@supabase/supabase-js';

type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];
type MembershipRow = Database['public']['Tables']['restaurant_memberships']['Row'];
type RestaurantMembership = Pick<MembershipRow, 'role'>;
type RestaurantWithMembership = RestaurantRow & { restaurant_memberships: RestaurantMembership[] };
type PublicSchema = Database['public'];
type DbClient = SupabaseClient<Database, 'public', 'public', PublicSchema>;

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
  logoUrl: string | null;
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

  const buildQuery = (includeLogo: boolean) => {
    let query = client
      .from('restaurants')
      .select(
        `
        ${restaurantSelectColumns(includeLogo)},
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

    return query.range(offset, offset + limit - 1);
  };

  type RestaurantsQueryResponse = PostgrestResponse<RestaurantWithMembership>;
  const normalizeRows = (rows: RestaurantWithMembership[] | null | undefined): RestaurantWithMembership[] =>
    (ensureLogoColumnOnRows(rows) ?? []) as RestaurantWithMembership[];

  let { data, error, count } = (await buildQuery(true)) as RestaurantsQueryResponse;

  if (error && isLogoUrlColumnMissing(error)) {
    logLogoColumnFallback('listRestaurantsForOps');
    const fallback = (await buildQuery(false)) as RestaurantsQueryResponse;
    data = normalizeRows(fallback.data);
    error = fallback.error;
    count = fallback.count;
  }

  if (error) {
    console.error('[listRestaurantsForOps] Query failed', error);
    throw new Error(`Failed to list restaurants: ${error.message}`);
  }

  const total = count ?? 0;
  const hasNext = offset + limit < total;

  const rowsWithLogo = normalizeRows(data);

  const restaurants: RestaurantListItem[] = rowsWithLogo.map((row) => {
    const role = (row.restaurant_memberships[0]?.role ?? 'viewer') as RestaurantListItem['role'];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      timezone: row.timezone,
      capacity: row.capacity,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      address: row.address,
      bookingPolicy: row.booking_policy,
      logoUrl: row.logo_url,
      reservationIntervalMinutes: row.reservation_interval_minutes,
      reservationDefaultDurationMinutes: row.reservation_default_duration_minutes,
      reservationLastSeatingBufferMinutes: row.reservation_last_seating_buffer_minutes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      role,
    };
  });

  return {
    restaurants,
    page,
    pageSize,
    total,
    hasNext,
  };
}
