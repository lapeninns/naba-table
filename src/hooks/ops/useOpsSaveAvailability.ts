'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import {
  getRestaurantAvailabilityRevision,
  saveRestaurantAvailability,
  type AvailabilityCommandPayload,
  type AvailabilitySaveResult,
} from '@/services/ops/availability';

import { dualSyncQueryKeys } from './opsIntegrationQueries';

import type { HttpError } from '@/lib/http/errors';
import type { RestaurantProfile } from '@/services/ops/restaurants';

/** Caches the availability save command writes from its response. */
function ownKeys(restaurantId: string) {
  return [
    queryKeys.opsRestaurants.hours(restaurantId),
    queryKeys.opsRestaurants.servicePeriods(restaurantId),
    queryKeys.opsRestaurants.turnBands(restaurantId),
    queryKeys.opsRestaurants.detail(restaurantId),
    queryKeys.opsRestaurants.availabilityRevision(restaurantId),
  ];
}

/**
 * The revision the availability save command checks (`expectedRevision`). Not persisted: a
 * restored revision older than freshly fetched settings would make the first save look stale.
 */
export function useOpsAvailabilityRevision(
  restaurantId?: string | null,
): UseQueryResult<string, HttpError | Error> {
  return useQuery<string, HttpError | Error>({
    queryKey: queryKeys.opsRestaurants.availabilityRevision(restaurantId ?? 'none'),
    queryFn: ({ signal }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return getRestaurantAvailabilityRevision(restaurantId, { signal });
    },
    enabled: Boolean(restaurantId),
    staleTime: 0,
    meta: { persist: false },
  });
}

/**
 * Writes the canonical save response into every cache it covers. The restaurant detail cache
 * only receives the booking-rule fields; its other fields did not change.
 */
export function applyAvailabilitySaveResult(
  queryClient: QueryClient,
  restaurantId: string,
  result: AvailabilitySaveResult,
): void {
  queryClient.setQueryData(queryKeys.opsRestaurants.hours(restaurantId), result.hours);
  queryClient.setQueryData(
    queryKeys.opsRestaurants.servicePeriods(restaurantId),
    result.servicePeriods,
  );
  queryClient.setQueryData(queryKeys.opsRestaurants.turnBands(restaurantId), result.turnBands);
  queryClient.setQueryData(
    queryKeys.opsRestaurants.availabilityRevision(restaurantId),
    result.revision,
  );
  queryClient.setQueryData<RestaurantProfile>(
    queryKeys.opsRestaurants.detail(restaurantId),
    (current) =>
      current
        ? {
            ...current,
            reservationIntervalMinutes: result.rules.reservationIntervalMinutes,
            reservationDefaultDurationMinutes: result.rules.reservationDefaultDurationMinutes,
            reservationLastSeatingBufferMinutes: result.rules.reservationLastSeatingBufferMinutes,
            reservationLifecycleGraceMinutes: result.rules.reservationLifecycleGraceMinutes,
            bookingPolicy: result.rules.bookingPolicy,
            updatedAt: result.rules.updatedAt ?? current.updatedAt,
          }
        : current,
  );
}

/**
 * The restaurant-owned part of "Save availability": one request, one database transaction.
 * On success the response is written into the hours, meal-time, table-time, restaurant-detail
 * and revision caches; only what the server derives from them is invalidated (the guest booking
 * schedule and the Google dual-sync comparison). Errors are shown inline by the page.
 */
export function useOpsSaveAvailability(
  restaurantId?: string | null,
): UseMutationResult<AvailabilitySaveResult, HttpError | Error, AvailabilityCommandPayload> {
  const queryClient = useQueryClient();

  return useMutation<AvailabilitySaveResult, HttpError | Error, AvailabilityCommandPayload>({
    scope: restaurantId ? { id: `restaurant-settings:availability:${restaurantId}` } : undefined,
    meta: { feedback: { error: false } },
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return saveRestaurantAvailability(restaurantId, payload);
    },
    onMutate: async () => {
      if (!restaurantId) return;
      // A read started before the save would otherwise land after it with the old settings.
      await Promise.all(
        ownKeys(restaurantId).map((queryKey) => queryClient.cancelQueries({ queryKey })),
      );
    },
    onSuccess: (result) => {
      if (!restaurantId) return;
      applyAvailabilitySaveResult(queryClient, restaurantId, result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.schedulePrefix() });
      // Dual-sync compares the live Core snapshot (hours, meal times) against Google.
      void queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.state(restaurantId) });
    },
  });
}
