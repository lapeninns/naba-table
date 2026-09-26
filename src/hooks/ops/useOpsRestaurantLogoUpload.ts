'use client';

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import {
  removeRestaurantLogo,
  uploadRestaurantLogo,
  type RestaurantLogoUploadResult,
  type RestaurantProfile,
} from '@/services/ops/restaurants';

import { dualSyncQueryKeys } from './opsIntegrationQueries';

import type { HttpError } from '@/lib/http/errors';
import type { QueryClient } from '@tanstack/react-query';

export type { RestaurantLogoUploadResult };

/**
 * Logo writes share the restaurant-details scope so they run in order with profile saves and
 * an older response cannot land last in the details cache.
 */
function restaurantDetailsScope(restaurantId?: string | null) {
  return restaurantId ? { id: `ops-restaurant-details:${restaurantId}` } : undefined;
}

/** An in-flight details GET started before the write would otherwise overwrite its response. */
async function cancelDetailsFetch(queryClient: QueryClient, restaurantId?: string | null) {
  if (!restaurantId) return;
  await queryClient.cancelQueries({ queryKey: queryKeys.opsRestaurants.detail(restaurantId) });
}

/** Writes the canonical restaurant; logoUrl is a dual-sync field, so its drift view refreshes. */
function applySavedProfile(
  queryClient: QueryClient,
  restaurantId: string,
  profile: RestaurantProfile,
) {
  queryClient.setQueryData(queryKeys.opsRestaurants.detail(restaurantId), profile);
  void queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.state(restaurantId) });
}

/**
 * Uploads a new logo. The server stores it under a new path, saves logo_url and returns the
 * restaurant, which becomes the details cache entry. Errors are shown inline by the uploader.
 */
export function useOpsRestaurantLogoUpload(
  restaurantId?: string | null,
): UseMutationResult<RestaurantLogoUploadResult, HttpError | Error, File> {
  const queryClient = useQueryClient();

  return useMutation<RestaurantLogoUploadResult, HttpError | Error, File>({
    scope: restaurantDetailsScope(restaurantId),
    meta: { feedback: { success: 'Logo uploaded and saved.', error: false } },
    mutationFn: (file) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return uploadRestaurantLogo(restaurantId, file);
    },
    onMutate: () => cancelDetailsFetch(queryClient, restaurantId),
    onSuccess: (result) => {
      if (!restaurantId) return;
      applySavedProfile(queryClient, restaurantId, result.profile);
    },
  });
}

/** Removes the logo: clears logo_url, then the server deletes the stored image. */
export function useOpsRemoveRestaurantLogo(
  restaurantId?: string | null,
): UseMutationResult<RestaurantProfile, HttpError | Error, void> {
  const queryClient = useQueryClient();

  return useMutation<RestaurantProfile, HttpError | Error, void>({
    scope: restaurantDetailsScope(restaurantId),
    meta: { feedback: { success: 'Logo removed.', error: false } },
    mutationFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return removeRestaurantLogo(restaurantId);
    },
    onMutate: () => cancelDetailsFetch(queryClient, restaurantId),
    onSuccess: (profile) => {
      if (!restaurantId) return;
      applySavedProfile(queryClient, restaurantId, profile);
    },
  });
}
