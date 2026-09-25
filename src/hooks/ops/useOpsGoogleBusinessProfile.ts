'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import { useRestaurantService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import {
  getGbpConnectionStateV1,
  getGbpTerminalNoticesV1,
  setGbpNotificationParticipationV1,
  setGbpWriteAccessV1,
} from '@/services/ops/dual-sync';

import {
  gbpOperatorQueryKeys,
  invalidateOpsIntegrationQueries,
  removeGbpOperatorQueries,
} from './opsIntegrationQueries';

import type { HttpError } from '@/lib/http/errors';
import type {
  GbpConnectionStateResponseV1,
  GbpNotificationParticipationResponseV1,
  GbpTerminalNoticesResponseV1,
  GbpWriteAccessRequestV1,
  SetGbpNotificationParticipationV1Request,
} from '@/services/ops/dual-sync';
import type {
  GoogleBusinessProfileAuthorizationStart,
  GoogleBusinessProfileAvailableLocation,
  GoogleBusinessProfileConnection,
  GoogleBusinessProfileProtectedActionPayload,
  LinkGoogleBusinessProfileLocationInput,
} from '@/services/ops/restaurants';

export function useOpsGbpOperatorState(restaurantId?: string | null) {
  const queryClient = useQueryClient();
  const enabled = Boolean(restaurantId);
  const queryRestaurantId = restaurantId ?? 'none';

  const connectionQuery = useQuery<GbpConnectionStateResponseV1, Error>({
    enabled,
    queryKey: gbpOperatorQueryKeys.connection(queryRestaurantId),
    queryFn: () => getGbpConnectionStateV1(queryRestaurantId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    meta: { persist: false },
  });
  const terminalNoticesQuery = useQuery<GbpTerminalNoticesResponseV1, Error>({
    enabled,
    queryKey: gbpOperatorQueryKeys.terminalNotices(queryRestaurantId),
    queryFn: () => getGbpTerminalNoticesV1(queryRestaurantId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    meta: { persist: false },
  });

  const setWriteAccessMutation = useMutation<
    GbpConnectionStateResponseV1,
    Error,
    GbpWriteAccessRequestV1
  >({
    mutationFn: (request) => setGbpWriteAccessV1(queryRestaurantId, request),
    onSuccess: (state, request) => {
      if (!request.eligible) {
        removeGbpOperatorQueries(queryClient, queryRestaurantId);
        return;
      }
      queryClient.setQueryData(gbpOperatorQueryKeys.connection(queryRestaurantId), state);
    },
  });
  const setNotificationParticipationMutation = useMutation<
    GbpNotificationParticipationResponseV1,
    Error,
    SetGbpNotificationParticipationV1Request
  >({
    mutationFn: (request) => setGbpNotificationParticipationV1(queryRestaurantId, request),
    onSuccess: (notifications) => {
      queryClient.setQueryData<GbpConnectionStateResponseV1>(
        gbpOperatorQueryKeys.connection(queryRestaurantId),
        (current) => (current ? { ...current, notifications } : current),
      );
    },
  });

  useEffect(
    () => () => {
      if (restaurantId) removeGbpOperatorQueries(queryClient, restaurantId);
    },
    [queryClient, restaurantId],
  );

  return {
    connectionQuery,
    terminalNoticesQuery,
    setWriteAccessMutation,
    setNotificationParticipationMutation,
  };
}

export function useOpsGoogleBusinessProfileConnection(
  restaurantId?: string | null,
  { enabled = true }: { readonly enabled?: boolean } = {},
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
    // Disabled callers keep the real key so they still read a cached connection.
    enabled: enabled && Boolean(restaurantId),
    staleTime: 30_000,
    meta: { persist: false },
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
    meta: { persist: false },
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
      removeGbpOperatorQueries(queryClient, restaurantId);
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
      removeGbpOperatorQueries(queryClient, restaurantId);
      queryClient.setQueryData(queryKeys.opsRestaurants.googleBusinessProfile(restaurantId), state);
      invalidateOpsIntegrationQueries(queryClient, restaurantId);
    },
  });
}
