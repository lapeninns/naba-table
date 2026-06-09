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

import { invalidateOpsIntegrationQueries } from './opsIntegrationQueries';

import type { HttpError } from '@/lib/http/errors';
import type {
  GoogleBusinessProfileAuthorizationStart,
  GoogleBusinessProfileAvailableLocation,
  GoogleBusinessProfileConnection,
  GoogleBusinessProfileProtectedActionPayload,
  LinkGoogleBusinessProfileLocationInput,
} from '@/services/ops/restaurants';

export function useOpsGoogleBusinessProfileConnection(
  restaurantId?: string | null,
): UseQueryResult<GoogleBusinessProfileConnection, HttpError> {
  const restaurantService = useRestaurantService();

  return useQuery<GoogleBusinessProfileConnection, HttpError>({
    queryKey: restaurantId
      ? queryKeys.opsRestaurants.googleBusinessProfile(restaurantId)
      : queryKeys.opsRestaurants.googleBusinessProfile('none'),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getGoogleBusinessProfileConnection(restaurantId);
    },
    enabled: Boolean(restaurantId),
    staleTime: 30_000,
  });
}

export function useOpsGoogleBusinessProfileAvailableLocations(
  restaurantId?: string | null,
  enabled = true,
): UseQueryResult<GoogleBusinessProfileAvailableLocation[], HttpError> {
  const restaurantService = useRestaurantService();

  return useQuery<GoogleBusinessProfileAvailableLocation[], HttpError>({
    queryKey: restaurantId
      ? queryKeys.opsRestaurants.googleBusinessProfileLocations(restaurantId)
      : queryKeys.opsRestaurants.googleBusinessProfileLocations('none'),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getGoogleBusinessProfileAvailableLocations(restaurantId);
    },
    enabled: Boolean(restaurantId) && enabled,
    staleTime: 10 * 60_000,
  });
}

export function useOpsStartGoogleBusinessProfileAuthorization(
  restaurantId?: string | null,
): UseMutationResult<GoogleBusinessProfileAuthorizationStart, HttpError | Error, void> {
  const restaurantService = useRestaurantService();

  return useMutation<GoogleBusinessProfileAuthorizationStart, HttpError | Error, void>({
    mutationFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.startGoogleBusinessProfileAuthorization(restaurantId);
    },
  });
}

export function useOpsLinkGoogleBusinessProfileLocation(
  restaurantId?: string | null,
): UseMutationResult<
  GoogleBusinessProfileConnection,
  HttpError | Error,
  LinkGoogleBusinessProfileLocationInput
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<
    GoogleBusinessProfileConnection,
    HttpError | Error,
    LinkGoogleBusinessProfileLocationInput
  >({
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.linkGoogleBusinessProfileLocation(restaurantId, payload);
    },
    onSuccess: (state) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), state);
      invalidateOpsIntegrationQueries(queryClient, restaurantId);
    },
  });
}

export function useOpsDisconnectGoogleBusinessProfile(
  restaurantId?: string | null,
): UseMutationResult<
  GoogleBusinessProfileConnection,
  HttpError | Error,
  GoogleBusinessProfileProtectedActionPayload
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<
    GoogleBusinessProfileConnection,
    HttpError | Error,
    GoogleBusinessProfileProtectedActionPayload
  >({
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.disconnectGoogleBusinessProfileConnection(restaurantId, payload);
    },
    onSuccess: (state) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), state);
      invalidateOpsIntegrationQueries(queryClient, restaurantId);
    },
  });
}
