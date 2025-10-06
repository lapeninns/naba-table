import { getServiceSupabaseClient } from '@/server/supabase';

export type RestaurantSummary = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
};

export class ListRestaurantsError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ListRestaurantsError';
    if (options?.cause) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export async function listRestaurants(): Promise<RestaurantSummary[]> {
  const supabase = getServiceSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id,name,slug,timezone,capacity')
      .order('name', { ascending: true });

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

    return data ?? [];
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
