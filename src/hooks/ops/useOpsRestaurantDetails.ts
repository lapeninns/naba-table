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

/** Fields whose change alters the guest booking schedule (slot grid, last seating, grace). */
function changesBookingSchedule(payload: Partial<RestaurantProfile>): boolean {
  return Object.keys(payload).some((key) => key === 'timezone' || key.startsWith('reservation'));
}

/** Fields shown wherever the restaurant is listed: the sidebar switcher and restaurant lists. */
function changesIdentity(payload: Partial<RestaurantProfile>): boolean {
  return payload.name !== undefined || payload.slug !== undefined;
}

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
): UseMutationResult<RestaurantProfile, HttpError | Error, Partial<RestaurantProfile>> {
  const restaurantService = useRestaurantService();
  const queryClient = useQueryClient();
  const { onIdentityChange } = options;

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
    onSuccess: (profile, payload) => {
      if (!restaurantId) return;
      queryClient.setQueryData(queryKeys.opsRestaurants.detail(restaurantId), profile);
      // Dual-sync state compares the live Core snapshot against Google, so drift moves with the save.
      void queryClient.invalidateQueries({ queryKey: dualSyncQueryKeys.state(restaurantId) });
      if (changesBookingSchedule(payload)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.schedulePrefix() });
      }
      if (payload.timezone !== undefined) {
        // "Today" and the summary windows are computed in the restaurant timezone.
        void queryClient.invalidateQueries({
          queryKey: queryKeys.opsDashboard.summaryPrefix(restaurantId),
        });
      }
      if (changesIdentity(payload)) {
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
