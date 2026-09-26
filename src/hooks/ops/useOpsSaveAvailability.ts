'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useAvailabilityService } from '@/contexts/availability-service';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import {
  type AvailabilityCommandPayload,
  type AvailabilitySnapshot,
} from '@/services/ops/availability';

import { dualSyncQueryKeys } from './opsIntegrationQueries';

import type { RestaurantProfile } from '@/services/ops/restaurants';

/** Caches the availability save command writes from its response. */
function ownKeys(restaurantId: string) {
  return [
    queryKeys.opsRestaurants.hours(restaurantId),
    queryKeys.opsRestaurants.servicePeriods(restaurantId),
    queryKeys.opsRestaurants.turnBands(restaurantId),
    queryKeys.opsRestaurants.detail(restaurantId),
    queryKeys.opsRestaurants.availability(restaurantId),
  ];
}

/**
 * The Availability page's source: hours, meal times, table times and booking rules together with
 * the revision of exactly those rows (one server read). The page builds its draft from this, never
 * from the single-resource caches, so the per-section `expectedRevisions` it sends always describe
 * the data the draft came from (only the sections a save writes are checked). Always refetched on mount (`staleTime: 0`); persisting is safe because a
 * restored snapshot carries its own, equally old, revision (a save from it is refused if stale).
 */
export function useOpsAvailability(
  restaurantId?: string | null,
): UseQueryResult<AvailabilitySnapshot, HttpError | Error> {
  const service = useAvailabilityService();
  return useQuery<AvailabilitySnapshot, HttpError | Error>({
    queryKey: queryKeys.opsRestaurants.availability(restaurantId ?? 'none'),
    queryFn: ({ signal }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return service.getAvailability(restaurantId, { signal });
    },
    enabled: Boolean(restaurantId),
    staleTime: 0,
  });
}

/**
 * Writes the canonical save response into every cache it covers. The restaurant detail cache
 * only receives the booking-rule fields; its other fields did not change.
 */
export function applyAvailabilitySnapshot(
  queryClient: QueryClient,
  restaurantId: string,
  result: AvailabilitySnapshot,
): void {
  queryClient.setQueryData(queryKeys.opsRestaurants.hours(restaurantId), result.hours);
  queryClient.setQueryData(
    queryKeys.opsRestaurants.servicePeriods(restaurantId),
    result.servicePeriods,
  );
  queryClient.setQueryData(queryKeys.opsRestaurants.turnBands(restaurantId), result.turnBands);
  queryClient.setQueryData(queryKeys.opsRestaurants.availability(restaurantId), result);
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

/** The stored settings changed since the draft's snapshot was read. */
function isStaleAvailabilityWrite(error: unknown): boolean {
  return (
    error instanceof HttpError &&
    (error.code === 'STALE_WRITE' || (error.status === 409 && error.code === 'HTTP_409'))
  );
}

/**
 * The restaurant-owned part of "Save availability": one request, one database transaction.
 * On success the response is written into the availability snapshot and the hours, meal-time,
 * table-time and restaurant-detail caches; only what the server derives from them is invalidated (the guest booking
 * schedule and the Google dual-sync comparison). Errors are shown inline by the page.
 *
 * A refused stale save (409 `STALE_WRITE`) refetches the snapshot: the page rebases its draft onto
 * the newer settings and their revision, so saving again can succeed instead of being refused
 * with the same old revision until the page is reloaded.
 */
export function useOpsSaveAvailability(
  restaurantId?: string | null,
): UseMutationResult<AvailabilitySnapshot, HttpError | Error, AvailabilityCommandPayload> {
  const queryClient = useQueryClient();
  const service = useAvailabilityService();

  return useMutation<AvailabilitySnapshot, HttpError | Error, AvailabilityCommandPayload>({
    scope: restaurantId ? { id: `restaurant-settings:availability:${restaurantId}` } : undefined,
    meta: { feedback: { error: false } },
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return service.saveAvailability(restaurantId, payload);
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
      applyAvailabilitySnapshot(queryClient, restaurantId, result);
      void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.schedulePrefix() });
      // Dual-sync compares the live Core snapshot (hours, meal times) against Google.
      void queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.state(restaurantId) });
    },
    onError: (error) => {
      if (!restaurantId) return;
      if (isStaleAvailabilityWrite(error)) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.opsRestaurants.availability(restaurantId),
          exact: true,
        });
      }
    },
  });
}
