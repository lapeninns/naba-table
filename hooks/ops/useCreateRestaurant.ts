'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

import type { CreateRestaurantInput, RestaurantResponse } from '@/app/api/ops/restaurants/schema';
import type { HttpError } from '@/lib/http/errors';


export function useCreateRestaurant() {
  const queryClient = useQueryClient();

  return useMutation<RestaurantResponse, HttpError, CreateRestaurantInput>({
    mutationFn: (input) =>
      fetchJson<RestaurantResponse>('/api/ops/restaurants', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opsRestaurants.all });
      toast.success(`Restaurant "${data.restaurant.name}" created successfully`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create restaurant');
    },
  });
}
