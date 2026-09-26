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
    queryFn: ({ signal }) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.getProfile(restaurantId, { signal });
    },
    enabled: Boolean(restaurantId),
    staleTime: OPS_SETTINGS_STALE_TIME.restaurantDetail,
    // Manager and contact names, phones and emails are PII; keep them out of the
    // localStorage query cache (see lib/query/persist.ts).
    meta: { persist: false },
  });
}

type ProfileField = keyof RestaurantProfile;

/**
 * Whether a saved field really changed on the server. With the pre-save profile in the cache,
 * the canonical response is compared against it, so a section that resends unchanged values
 * (for example the whole public-details form) does not look like a change. Without a cached
 * profile, a field sent in the payload is treated as changed.
 */
function fieldChanged(
  field: ProfileField,
  payload: Partial<RestaurantProfile>,
  saved: RestaurantProfile,
  previous: RestaurantProfile | undefined,
): boolean {
  if (!previous) {
    return payload[field] !== undefined;
  }
  return saved[field] !== previous[field];
}

const BOOKING_SCHEDULE_FIELDS: readonly ProfileField[] = [
  'timezone',
  'reservationIntervalMinutes',
  'reservationDefaultDurationMinutes',
  'reservationLastSeatingBufferMinutes',
  'reservationLifecycleGraceMinutes',
];

/** Fields shown wherever the restaurant is listed: the sidebar switcher and restaurant lists. */
const IDENTITY_FIELDS: readonly ProfileField[] = ['name', 'slug'];

type UpdateRestaurantDetailsContext = { previous: RestaurantProfile | undefined };

export type UseOpsUpdateRestaurantDetailsOptions = {
  /**
   * Called after a save that changed the name or slug. The ops session memberships (sidebar
   * switcher, booking links) come from the server layout, so the page refreshes them, typically
   * with `router.refresh()`. The hook itself never navigates.
   */
  onIdentityChange?: (profile: RestaurantProfile) => void;
};

export function useOpsUpdateRestaurantDetails(
  restaurantId?: string | null,
  options: UseOpsUpdateRestaurantDetailsOptions = {},
): UseMutationResult<
  RestaurantProfile,
  HttpError | Error,
  Partial<RestaurantProfile>,
  UpdateRestaurantDetailsContext
> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();
  const { onIdentityChange } = options;

  return useMutation<
    RestaurantProfile,
    HttpError | Error,
    Partial<RestaurantProfile>,
    UpdateRestaurantDetailsContext
  >({
    // Saves for one restaurant run serially so an older response cannot land last.
    scope: restaurantId ? { id: `ops-restaurant-details:${restaurantId}` } : undefined,
    mutationFn: (payload) => {
      if (!restaurantId) {
        throw new Error('Restaurant id is required');
      }
      return restaurantService.updateProfile(restaurantId, payload);
    },
    onMutate: async () => {
      if (!restaurantId) return { previous: undefined };
      const detailKey = queryKeys.opsRestaurants.detail(restaurantId);
      // An in-flight GET started before the save would otherwise overwrite the saved profile.
      await queryClient.cancelQueries({ queryKey: detailKey });
      return { previous: queryClient.getQueryData<RestaurantProfile>(detailKey) };
    },
    onSuccess: (profile, payload, context) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.detail(restaurantId), profile);
      // Dual-sync state compares the live Core snapshot against Google, so drift moves with the save.
      void queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.state(restaurantId) });
      const previous = context?.previous;
      const changed = (field: ProfileField) => fieldChanged(field, payload, profile, previous);
      if (BOOKING_SCHEDULE_FIELDS.some(changed)) {
        // Slot grid, last seating and grace windows are derived from these.
        void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.schedulePrefix() });
      }
      if (changed('timezone')) {
        // "Today" and the summary windows are computed in the restaurant timezone.
        void queryClient.invalidateQueries({
          queryKey: queryKeys.opsDashboard.summaryPrefix(restaurantId),
        });
      }
      if (IDENTITY_FIELDS.some(changed)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.opsRestaurants.list() });
        onIdentityChange?.(profile);
      }
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
