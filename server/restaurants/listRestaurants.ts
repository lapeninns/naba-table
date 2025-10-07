import type { RestaurantFilters, RestaurantSummary } from '@/lib/restaurants/types';
import { getServiceSupabaseClient } from '@/server/supabase';

export class ListRestaurantsError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ListRestaurantsError';
    if (options?.cause) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export async function listRestaurants(filters: RestaurantFilters = {}): Promise<RestaurantSummary[]> {
  const supabase = getServiceSupabaseClient();

  try {
    const normalizedSearch = filters.search?.trim();
    let query = supabase
      .from('restaurants')
      .select('id,name,slug,timezone,capacity')
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

    const { data, error } = await query;

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
        }
      );
    }

    return (data ?? []) as RestaurantSummary[];
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
