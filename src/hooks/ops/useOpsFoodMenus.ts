'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import {
  decideFoodMenusImportReview,
  listFoodMenusImportReviews,
  refreshFoodMenusImportReview,
} from '@/services/ops/food-menus';

import type {
  DecideFoodMenusImportReviewRequest,
  DecideFoodMenusImportReviewResponse,
  ListFoodMenusImportReviewsResponse,
  RefreshFoodMenusImportReviewRequest,
  RefreshFoodMenusImportReviewResponse,
} from '@/services/ops/food-menus';

export interface UseOpsFoodMenusArgs {
  readonly restaurantId: string | null;
  readonly enabled?: boolean;
}

export function useOpsFoodMenus({ restaurantId, enabled = true }: UseOpsFoodMenusArgs) {
  const queryClient = useQueryClient();
  const queryEnabled = Boolean(restaurantId) && enabled;

  const importReviewsQuery = useQuery<ListFoodMenusImportReviewsResponse>({
    enabled: queryEnabled,
    queryKey: queryEnabled
      ? queryKeys.opsFoodMenus.importReviews(restaurantId as string)
      : ['ops', 'food-menus', 'noop', 'import-reviews'],
    queryFn: () => listFoodMenusImportReviews(restaurantId as string),
  });

  const invalidateFoodMenus = async () => {
    if (!restaurantId) return;
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.opsFoodMenus.importReviews(restaurantId),
      }),
      queryClient.invalidateQueries({ queryKey: ['dual-sync-state', restaurantId] }),
      queryClient.invalidateQueries({ queryKey: ['ops', 'menu', restaurantId] }),
    ]);
  };

  const refreshImportReviewMutation = useMutation<
    RefreshFoodMenusImportReviewResponse,
    Error,
    RefreshFoodMenusImportReviewRequest | void
  >({
    mutationFn: (request) => {
      if (!restaurantId) {
        return Promise.reject(
          new Error('restaurantId is required to refresh FoodMenus import reviews.'),
        );
      }
      return refreshFoodMenusImportReview(restaurantId, request ?? { persist: true });
    },
    onSuccess: invalidateFoodMenus,
  });

  const decideImportReviewMutation = useMutation<
    DecideFoodMenusImportReviewResponse,
    Error,
    DecideFoodMenusImportReviewRequest
  >({
    mutationFn: (request) => {
      if (!restaurantId) {
        return Promise.reject(
          new Error('restaurantId is required to decide a FoodMenus import review.'),
        );
      }
      return decideFoodMenusImportReview(restaurantId, request);
    },
    onSuccess: invalidateFoodMenus,
  });

  return {
    importReviewsQuery,
    refreshImportReviewMutation,
    decideImportReviewMutation,
  };
}
