import { ensureLogoColumnOnRow, isLogoUrlColumnMissing, logLogoColumnFallback } from '@/server/restaurants/logo-url-compat';
import { restaurantSelectColumns } from '@/server/restaurants/select-fields';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { RestaurantSummary } from '@/lib/restaurants/types';
import type { Database } from '@/types/supabase';

type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];

export type RestaurantDetail = RestaurantSummary;

export class GetRestaurantBySlugError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'GetRestaurantBySlugError';
    if (options?.cause) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export async function getRestaurantBySlug(slug: string): Promise<RestaurantDetail | null> {
  const normalized = slug.trim();
  if (!normalized) {
    return null;
  }

  const supabase = getServiceSupabaseClient();

  try {
    const execute = (includeLogo: boolean) =>
      supabase
        .from('restaurants')
        .select(restaurantSelectColumns(includeLogo))
        .eq('slug', normalized)
        .maybeSingle<RestaurantRow>();

    let { data, error } = await execute(true);

    if (error && isLogoUrlColumnMissing(error)) {
      logLogoColumnFallback('getRestaurantBySlug');
      ({ data, error } = await execute(false));
      data = ensureLogoColumnOnRow(data);
    }

    if (error) {
      throw new GetRestaurantBySlugError(`[restaurants] failed to load restaurant for slug ${normalized}`, {
        cause: error,
      });
    }

    const restaurant = ensureLogoColumnOnRow(data);
    if (!restaurant) {
      return null;
    }

    return {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      timezone: restaurant.timezone,
      capacity: restaurant.capacity,
      address: restaurant.address,
      bookingPolicy: restaurant.booking_policy ?? null,
      contactEmail: restaurant.contact_email ?? null,
      contactPhone: restaurant.contact_phone ?? null,
      googleMapUrl: restaurant.google_map_url ?? null,
      logoUrl: restaurant.logo_url ?? null,
      reservationIntervalMinutes: restaurant.reservation_interval_minutes ?? null,
      reservationDefaultDurationMinutes: restaurant.reservation_default_duration_minutes ?? null,
      reservationLastSeatingBufferMinutes: restaurant.reservation_last_seating_buffer_minutes ?? null,
      createdAt: restaurant.created_at ?? undefined,
      updatedAt: restaurant.updated_at ?? undefined,
    } satisfies RestaurantDetail;
  } catch (error) {
    if (error instanceof GetRestaurantBySlugError) {
      throw error;
    }

    throw new GetRestaurantBySlugError(
      `[restaurants] unexpected error loading restaurant for slug ${normalized}`,
      { cause: error },
    );
  }
}
