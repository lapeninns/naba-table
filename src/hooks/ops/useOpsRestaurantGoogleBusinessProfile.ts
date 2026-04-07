'use client';

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';

import { useRestaurantService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';
import type { RestaurantGoogleBusinessProfileConnection } from '@/lib/restaurants/google-business-profile';

export function useOpsRestaurantGoogleBusinessProfile(
  restaurantId?: string | null,
): UseQueryResult<RestaurantGoogleBusinessProfileConnection, HttpError> {
  const restaurantService = useRestaurantService();

  return useQuery<RestaurantGoogleBusinessProfileConnection, HttpError>({
    queryKey: restaurantId
      ? queryKeys.opsRestaurants.googleBusinessProfile(restaurantId)
      : queryKeys.opsRestaurants.googleBusinessProfile('none'),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getGoogleBusinessProfileStatus(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: 30_000,
  });
}

export function useOpsRestaurantGoogleBusinessProfileConnect(
  restaurantId?: string | null,
): UseMutationResult<string, HttpError | Error, void> {
  const restaurantService = useRestaurantService();

  return useMutation({
    mutationFn: async () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getGoogleBusinessProfileConnectUrl(restaurantId);
    },
  });
}

export function useOpsRefreshRestaurantGoogleBusinessProfileCatalog(
  restaurantId?: string | null,
): UseMutationResult<RestaurantGoogleBusinessProfileConnection, HttpError | Error, void> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.refreshGoogleBusinessProfileCatalog(restaurantId);
    },
    onSuccess: async (connection) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), connection);
    },
  });
}

export function useOpsSyncRestaurantGoogleBusinessProfile(
  restaurantId?: string | null,
): UseMutationResult<
  RestaurantGoogleBusinessProfileConnection,
  HttpError | Error,
  { accountId?: string | null; locationId?: string | null } | void
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.syncGoogleBusinessProfile(restaurantId, payload ?? {});
    },
    onSuccess: async (connection) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), connection);
    },
  });
}

export function useOpsDisconnectRestaurantGoogleBusinessProfile(
  restaurantId?: string | null,
): UseMutationResult<void, HttpError | Error, void> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      await restaurantService.disconnectGoogleBusinessProfile(restaurantId);
    },
    onSuccess: async () => {
      if (!restaurantId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.opsRestaurants.googleBusinessProfile(restaurantId) });
    },
  });
}
