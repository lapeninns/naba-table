import { getActiveRestaurantId } from '@/server/restaurants/getActiveRestaurantId';
import { getRestaurantBySlug } from '@/server/restaurants/getRestaurantBySlug';
import {
  getDefaultRestaurantId,
  getServiceSupabaseClient,
  MissingRestaurantContextError,
} from '@/server/supabase';

export type BookingRestaurantResolutionResult =
  | { ok: true; restaurantId: string; source: 'payload' | 'slug' | 'default' }
  | { ok: false; status: number; code: string; error: string };

function stringifyRestaurantResolutionError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

export async function resolveBookingRestaurantId(options: {
  restaurantId?: string | null;
  restaurantSlug?: string | null;
}): Promise<BookingRestaurantResolutionResult> {
  const slug = options.restaurantSlug?.trim().toLowerCase();
  if (slug) {
    try {
      const restaurant = await getRestaurantBySlug(slug);
      if (restaurant?.id) {
        return { ok: true, restaurantId: restaurant.id, source: 'slug' };
      }
      return {
        ok: false,
        status: 404,
        code: 'RESTAURANT_NOT_FOUND',
        error: 'Restaurant not found',
      };
    } catch (error) {
      console.error('[bookings][POST][slug-lookup]', stringifyRestaurantResolutionError(error));
      return {
        ok: false,
        status: 500,
        code: 'RESTAURANT_LOOKUP_FAILED',
        error: 'Unable to resolve restaurant',
      };
    }
  }

  const directId = options.restaurantId?.trim();
  if (directId) {
    try {
      const restaurantId = await getActiveRestaurantId(directId);
      if (restaurantId) {
        return { ok: true, restaurantId, source: 'payload' };
      }
      return {
        ok: false,
        status: 404,
        code: 'RESTAURANT_NOT_FOUND',
        error: 'Restaurant not found',
      };
    } catch (error) {
      console.error(
        '[bookings][POST][restaurant-id-lookup]',
        stringifyRestaurantResolutionError(error),
      );
      return {
        ok: false,
        status: 500,
        code: 'RESTAURANT_LOOKUP_FAILED',
        error: 'Unable to resolve restaurant',
      };
    }
  }

  try {
    const fallbackId = await getDefaultRestaurantId();
    const supabase = getServiceSupabaseClient();
    const { data, error } = await supabase
      .from('restaurants')
      .select('id')
      .eq('id', fallbackId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error(
        '[bookings][POST][default-restaurant]',
        stringifyRestaurantResolutionError(error),
      );
      return {
        ok: false,
        status: 500,
        code: 'RESTAURANT_LOOKUP_FAILED',
        error: 'Unable to resolve restaurant',
      };
    }

    if (!data?.id) {
      return {
        ok: false,
        status: 404,
        code: 'RESTAURANT_NOT_FOUND',
        error: 'Restaurant not found',
      };
    }

    return { ok: true, restaurantId: data.id, source: 'default' };
  } catch (error) {
    if (error instanceof MissingRestaurantContextError) {
      return {
        ok: false,
        status: 400,
        code: 'RESTAURANT_REQUIRED',
        error: 'restaurantId or restaurantSlug is required',
      };
    }

    console.error(
      '[bookings][POST][default-restaurant]',
      stringifyRestaurantResolutionError(error),
    );
    return {
      ok: false,
      status: 500,
      code: 'RESTAURANT_LOOKUP_FAILED',
      error: 'Unable to resolve restaurant',
    };
  }
}
