'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useRestaurantService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import { OPS_SETTINGS_STALE_TIME } from '@/lib/query/staleTimes';

import { dualSyncQueryKeys } from './opsIntegrationQueries';

import type { HttpError } from '@/lib/http/errors';
import type {
  GoogleBusinessProfileProfileSyncPayload,
  RestaurantProfile,
} from '@/services/ops/restaurants';

export function useOpsRestaurantDetails(
  restaurantId?: string | null,
): UseQueryResult<RestaurantProfile, HttpError> {
  const restaurantService = useRestaurantService();

  return useQuery<RestaurantProfile, HttpError>({
    queryKey: restaurantId
      ? queryKeys.opsRestaurants.detail(restaurantId)
      : queryKeys.opsRestaurants.detail('none'),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getProfile(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: OPS_SETTINGS_STALE_TIME.restaurantDetail,
    // Manager and contact names, phones and emails are PII; keep them out of the
    // localStorage query cache (see lib/query/persist.ts).
    meta: { persist: false },
  });
}

export function useOpsUpdateRestaurantDetails(
  restaurantId?: string | null,
): UseMutationResult<RestaurantProfile, HttpError | Error, Partial<RestaurantProfile>> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<RestaurantProfile, HttpError | Error, Partial<RestaurantProfile>>({
    // Saves for one restaurant run serially so an older response cannot land last.
    scope: restaurantId ? { id: `ops-restaurant-details:${restaurantId}` } : undefined,
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.updateProfile(restaurantId, payload);
    },
    onMutate: async () => {
      if (!restaurantId) return;
      // An in-flight GET started before the save would otherwise overwrite the saved profile.
      await queryClient.cancelQueries({ queryKey: queryKeys.opsRestaurants.detail(restaurantId) });
    },
    onSuccess: (profile) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.detail(restaurantId), profile);
      // Dual-sync state compares the live Core snapshot against Google, so drift moves with the save.
      void queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.state(restaurantId) });
    },
  });
}

export function useOpsSyncRestaurantDetailsWithGoogleBusinessProfile(
  restaurantId?: string | null,
): UseMutationResult<
  RestaurantProfile,
  HttpError | Error,
  GoogleBusinessProfileProfileSyncPayload
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.syncProfileWithGoogleBusinessProfile(restaurantId, payload);
    },
    onSuccess: (profile) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.detail(restaurantId), profile);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId),
      });
    },
  });
}
