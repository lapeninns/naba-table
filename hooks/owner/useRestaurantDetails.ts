'use client';

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

export type RestaurantDetails = {
  restaurantId: string;
  name: string;
  slug: string;
  timezone: string;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  bookingPolicy: string | null;
};

export type UpdateRestaurantDetailsInput = {
  name: string;
  slug: string;
  timezone: string;
  capacity?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  bookingPolicy?: string | null;
};

const DISABLED_KEY = ['owner', 'restaurants', 'disabled', 'details'] as const;

export function useRestaurantDetails(
  restaurantId: string | null,
): UseQueryResult<RestaurantDetails, HttpError> {
  const queryKey = restaurantId ? queryKeys.ownerRestaurants.details(restaurantId) : DISABLED_KEY;

  return useQuery<RestaurantDetails, HttpError>({
    queryKey,
    queryFn: async () => {
      if (!restaurantId) {
        throw new HttpError({ message: 'Restaurant id is required', status: 400, code: 'MISSING_RESTAURANT' });
      }

      return fetchJson<RestaurantDetails>(`/api/owner/restaurants/${restaurantId}/details`);
    },
    enabled: Boolean(restaurantId),
  });
}

export function useUpdateRestaurantDetails(restaurantId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<RestaurantDetails, HttpError, UpdateRestaurantDetailsInput>({
    mutationFn: async (input) => {
      if (!restaurantId) {
        throw new HttpError({ message: 'Restaurant id is required', status: 400, code: 'MISSING_RESTAURANT' });
      }

      return fetchJson<RestaurantDetails>(`/api/owner/restaurants/${restaurantId}/details`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: input.name,
          slug: input.slug,
          timezone: input.timezone,
          capacity: input.capacity ?? null,
          phone: input.contactPhone ?? null,
          email: input.contactEmail ?? null,
          address: input.address ?? null,
          bookingPolicy: input.bookingPolicy ?? null,
        }),
      });
    },
    onSuccess: (data) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.ownerRestaurants.details(restaurantId), data);
    },
  });
}
