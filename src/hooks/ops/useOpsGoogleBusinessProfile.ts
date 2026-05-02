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

import type { HttpError } from '@/lib/http/errors';
import type {
  GoogleBusinessProfileConnection,
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
    },
  });
}

export function useOpsDisconnectGoogleBusinessProfile(
  restaurantId?: string | null,
): UseMutationResult<GoogleBusinessProfileConnection, HttpError | Error, void> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();

  return useMutation<GoogleBusinessProfileConnection, HttpError | Error, void>({
    mutationFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.disconnectGoogleBusinessProfileConnection(restaurantId);
    },
    onSuccess: (state) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), state);
    },
  });
}
