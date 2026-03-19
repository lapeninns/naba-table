import { debounce } from '../debounceThrottle';

import type { QueryClient, QueryKey } from '@tanstack/react-query';


type RealtimeEventPayload = {
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
};

function getPayloadStringValues(payload: unknown, key: string): string[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const eventPayload = payload as RealtimeEventPayload;
  const values = [eventPayload.new?.[key], eventPayload.old?.[key]];
  return Array.from(
    new Set(
      values.filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  );
}

export function matchesDashboardSummaryRealtimePayload(params: {
  payload: unknown;
  restaurantId: string;
  effectiveDate?: string | null;
}): boolean {
  const { payload, restaurantId, effectiveDate = null } = params;

  const restaurantIds = getPayloadStringValues(payload, 'restaurant_id');
  if (restaurantIds.length > 0 && !restaurantIds.includes(restaurantId)) {
    return false;
  }

  if (!effectiveDate) {
    return true;
  }

  const bookingDates = getPayloadStringValues(payload, 'booking_date');
  if (bookingDates.length > 0 && !bookingDates.includes(effectiveDate)) {
    return false;
  }

  return true;
}

export function createScopedRealtimeInvalidator(params: {
  queryClient: QueryClient;
  queryKey: QueryKey;
  waitMs: number;
}) {
  const { queryClient, queryKey, waitMs } = params;
  let isActive = true;

  return {
    run: debounce(() => {
      if (!isActive) return;
      queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
    }, waitMs),
    deactivate: () => {
      isActive = false;
    },
  };
}
