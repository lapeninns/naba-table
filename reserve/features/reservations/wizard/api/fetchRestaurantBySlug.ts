import { apiClient } from '@shared/api/client';

import type { VenueDetails } from '@reserve/shared/config/venue';

export async function fetchRestaurantBySlug(
  slug: string,
  options?: { signal?: AbortSignal },
): Promise<VenueDetails> {
  const response = await apiClient.get<{ restaurant: VenueDetails }>(`/restaurants/${slug}`, {
    signal: options?.signal,
  });

  if (!response?.restaurant) {
    throw new Error('Restaurant not found');
  }

  return response.restaurant;
}
