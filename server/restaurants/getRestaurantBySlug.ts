import { getServiceSupabaseClient } from '@/server/supabase';

import type { RestaurantSummary } from '@/lib/restaurants/types';

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
    const { data, error } = await supabase
      .from('restaurants')
      .select('id,name,slug,timezone,capacity')
      .eq('slug', normalized)
      .maybeSingle();

    if (error) {
      throw new GetRestaurantBySlugError(`[restaurants] failed to load restaurant for slug ${normalized}`, {
        cause: error,
      });
    }

    return data ?? null;
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
