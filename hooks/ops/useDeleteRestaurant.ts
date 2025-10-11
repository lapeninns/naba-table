'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

import type {
  DeleteRestaurantResponse,
  RestaurantDTO,
  RestaurantsListResponse,
} from '@/app/api/ops/restaurants/schema';
import { fetchJson } from '@/lib/http/fetchJson';
import type { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

export type DeleteRestaurantInput = {
  id: string;
  name: string;
};

export type DeleteRestaurantContext = {
  lists: Array<[QueryKey, RestaurantsListResponse | undefined]>;
  detail: RestaurantDTO | undefined;
};

export function useDeleteRestaurant() {
  const queryClient = useQueryClient();

  return useMutation<DeleteRestaurantResponse, HttpError, DeleteRestaurantInput, DeleteRestaurantContext>({
    mutationFn: ({ id }) =>
      fetchJson<DeleteRestaurantResponse>(`/api/ops/restaurants/${id}`, {
        method: 'DELETE',
      }),
    onMutate: async ({ id }) => {
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
          items: listData.items.filter((restaurant) => restaurant.id !== id),
          pageInfo: {
            ...listData.pageInfo,
            total: listData.pageInfo.total - 1,
          },
        });
      });

      return { lists, detail };
    },
    onSuccess: (_result, variables) => {
      toast.success(`Restaurant "${variables.name}" deleted successfully`);
    },
    onError: (error, variables, context) => {
      toast.error(error.message || 'Failed to delete restaurant');
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
