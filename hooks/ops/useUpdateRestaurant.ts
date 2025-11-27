'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

import type {
  UpdateRestaurantInput,
  RestaurantResponse,
  RestaurantDTO,
  RestaurantsListResponse,
} from '@/app/api/ops/restaurants/schema';
import type { HttpError } from '@/lib/http/errors';


export type UpdateRestaurantMutationInput = {
  id: string;
  data: UpdateRestaurantInput;
};

export type UpdateRestaurantContext = {
  lists: Array<[QueryKey, RestaurantsListResponse | undefined]>;
  detail: RestaurantDTO | undefined;
};

export function useUpdateRestaurant() {
  const queryClient = useQueryClient();

  return useMutation<RestaurantResponse, HttpError, UpdateRestaurantMutationInput, UpdateRestaurantContext>({
    mutationFn: ({ id, data }) =>
      fetchJson<RestaurantResponse>(`/api/ops/restaurants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.opsRestaurants.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.opsRestaurants.detail(id) });

      const lists = queryClient.getQueriesData<RestaurantsListResponse>({
        queryKey: queryKeys.opsRestaurants.all,
      });
      const detail = queryClient.getQueryData<RestaurantDTO>(queryKeys.opsRestaurants.detail(id));

      lists.forEach(([key, listData]) => {
        if (!listData) return;
        queryClient.setQueryData<RestaurantsListResponse>(key, {
          ...listData,
          items: listData.items.map((restaurant) =>
            restaurant.id === id ? { ...restaurant, ...data } : restaurant,
          ),
        });
      });

      if (detail) {
        queryClient.setQueryData(queryKeys.opsRestaurants.detail(id), {
          ...detail,
          ...data,
        });
      }

      return { lists, detail };
    },
    onSuccess: (response) => {
      toast.success(`Restaurant "${response.restaurant.name}" updated successfully`);
    },
    onError: (error, variables, context) => {
      toast.error(error.message || 'Failed to update restaurant');
      context?.lists.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      if (context?.detail) {
        queryClient.setQueryData(queryKeys.opsRestaurants.detail(variables.id), context.detail);
      }
    },
    onSettled: (_result, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.opsRestaurants.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.opsRestaurants.detail(variables.id) });
    },
  });
}
