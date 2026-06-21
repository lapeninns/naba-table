import { listQaRestaurantFixtures } from '@/server/restaurants/qa-fixtures';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { RestaurantFilters, RestaurantSummary } from '@/lib/restaurants/types';
import type { Database } from '@/types/supabase';
import type { PostgrestResponse } from '@supabase/supabase-js';

export class ListRestaurantsError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ListRestaurantsError';
    if (options?.cause) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export async function listRestaurants(
  filters: RestaurantFilters = {},
): Promise<RestaurantSummary[]> {
  const qaFixtures = listQaRestaurantFixtures(filters);
  if (qaFixtures) {
    return qaFixtures;
  }

  const supabase = getServiceSupabaseClient();

  try {
    const normalizedSearch = filters.search?.trim();
    const columns = [
      'id',
      'name',
      'slug',
      'timezone',
      'capacity',
      'address',
      'booking_policy',
      // triage-039: contact_email / contact_phone are owner/manager contact PII and are
      // intentionally NOT selected for the public, unauthenticated restaurant list.
      'google_map_url',
      'logo_url',
      'is_active',
      'reservation_interval_minutes',
      'reservation_default_duration_minutes',
      'reservation_lifecycle_grace_minutes',
      'reservation_last_seating_buffer_minutes',
      'created_at',
      'updated_at',
    ].join(',');

    let query = supabase
      .from('restaurants')
      .select(columns)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (normalizedSearch) {
      const pattern = `%${normalizedSearch.replace(/\s+/g, '%')}%`;
      query = query.ilike('name', pattern);
    }

    if (filters.timezone && filters.timezone !== 'all') {
      query = query.eq('timezone', filters.timezone);
    }

    if (typeof filters.minCapacity === 'number' && Number.isFinite(filters.minCapacity)) {
      query = query.gte('capacity', Math.max(0, filters.minCapacity));
    }

    type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];
    type RestaurantsResponse = PostgrestResponse<RestaurantRow>;

    const { data, error } = (await query) as RestaurantsResponse;

    if (error) {
      // Enhanced error logging to help diagnose the issue
      console.error('[listRestaurants] Supabase error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      throw new ListRestaurantsError(
        `[restaurants] failed to load restaurant list: ${error.message}`,
        {
          cause: error,
        },
      );
    }

    const rows = (data ?? []) as RestaurantRow[];

    const mapped: RestaurantSummary[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      timezone: row.timezone,
      capacity: row.capacity,
      address: row.address,
      bookingPolicy: row.booking_policy,
      // triage-039: do not expose contact PII on the public list (see column projection above).
      googleMapUrl: row.google_map_url,
      logoUrl: row.logo_url,
      isActive: row.is_active,
      reservationIntervalMinutes: row.reservation_interval_minutes,
      reservationDefaultDurationMinutes: row.reservation_default_duration_minutes,
      reservationLastSeatingBufferMinutes: row.reservation_last_seating_buffer_minutes,
      reservationLifecycleGraceMinutes: row.reservation_lifecycle_grace_minutes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return mapped;
  } catch (error) {
    if (error instanceof ListRestaurantsError) {
      throw error;
    }

    console.error('[listRestaurants] Unexpected error:', error);
    throw new ListRestaurantsError('[restaurants] unexpected error loading restaurant list', {
      cause: error,
    });
  }
}
