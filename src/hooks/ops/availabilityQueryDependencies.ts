import { queryKeys } from '@/lib/query/keys';

import type { QueryClient, QueryKey } from '@tanstack/react-query';

export type AvailabilityResource = 'hours' | 'service-periods' | 'turn-bands';

/**
 * Guest schedule cache (`scheduleQueryKey` in reserve/.../schedule.ts) used by
 * the booking wizard and the ops edit-booking picker. Those keys carry the
 * restaurant slug, which the settings hooks do not have, so the prefix is used.
 */
const RESERVATION_SCHEDULE_PREFIX = ['reservations', 'schedule'] as const;

/**
 * Queries derived from an availability resource on the server. The resource's
 * own key is not listed: saves write the PUT response straight into it.
 * - Turn-band `defaults` are derived from service periods by the turn-bands route.
 * - The reservation schedule is built from hours, periods and turn bands.
 */
export function availabilityDependentKeys(
  resource: AvailabilityResource,
  restaurantId: string,
): QueryKey[] {
  switch (resource) {
    case 'service-periods':
      return [queryKeys.opsRestaurants.turnBands(restaurantId), RESERVATION_SCHEDULE_PREFIX];
    case 'hours':
    case 'turn-bands':
      return [RESERVATION_SCHEDULE_PREFIX];
  }
}

export function invalidateAvailabilityDependents(
  queryClient: QueryClient,
  resource: AvailabilityResource,
  restaurantId: string,
): Promise<void[]> {
  return Promise.all(
    availabilityDependentKeys(resource, restaurantId).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

/** Same id => TanStack runs the saves serially, so PUTs land in submit order. */
export function availabilityMutationScope(
  resource: AvailabilityResource,
  restaurantId: string | null | undefined,
): { id: string } | undefined {
  return restaurantId ? { id: `restaurant-settings:${resource}:${restaurantId}` } : undefined;
}
