'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';
import {
  SMS_DELIVERY_STATUS_VALUES,
  type OpsSmsDeliveryFeedResponse,
  type OpsSmsDeliveryRange,
  type SmsDeliveryChannelFilter,
  type SmsDeliveryStatus,
} from '@/types/smsDelivery';

import type { HttpError } from '@/lib/http/errors';

type UseOpsRestaurantSmsDeliveryFeedParams = {
  restaurantId: string | null;
  range: OpsSmsDeliveryRange;
  page: number;
  pageSize: number;
  statuses?: readonly SmsDeliveryStatus[];
  channel?: SmsDeliveryChannelFilter;
};

export type OpsRestaurantSmsDeliveryFeedState = {
  response: OpsSmsDeliveryFeedResponse | null;
  feed: Extract<OpsSmsDeliveryFeedResponse, { ok: true }> | null;
  unavailable: boolean;
  apiError: string | null;
};

function normalizeStatuses(
  statuses: readonly SmsDeliveryStatus[] | undefined,
): SmsDeliveryStatus[] {
  if (!statuses?.length) return [];
  const selected = new Set(statuses);
  return SMS_DELIVERY_STATUS_VALUES.filter((status) => selected.has(status));
}

export function useOpsRestaurantSmsDeliveryFeed({
  restaurantId,
  range,
  page,
  pageSize,
  statuses,
  channel = 'all',
}: UseOpsRestaurantSmsDeliveryFeedParams): UseQueryResult<OpsSmsDeliveryFeedResponse, HttpError> &
  OpsRestaurantSmsDeliveryFeedState {
  const bookingService = useBookingService();
  const normalizedStatuses = useMemo(() => normalizeStatuses(statuses), [statuses]);
  const enabled = Boolean(restaurantId);
  const queryRestaurantId = restaurantId ?? 'disabled';

  const query = useQuery<OpsSmsDeliveryFeedResponse, HttpError>({
    queryKey: queryKeys.opsSmsDelivery.restaurantFeed({
      restaurantId: queryRestaurantId,
      range,
      page,
      pageSize,
      statuses: normalizedStatuses,
      channel,
    }),
    queryFn: () =>
      bookingService.getRestaurantSmsDeliveryFeed({
        restaurantId: restaurantId ?? undefined,
        range,
        page,
        pageSize,
        status: normalizedStatuses.length > 0 ? normalizedStatuses : undefined,
        channel,
      }),
    enabled,
    staleTime: 30_000,
  });

  const derived = useMemo<OpsRestaurantSmsDeliveryFeedState>(() => {
    const response = query.data ?? null;
    const feed = response && response.ok ? response : null;
    const unavailable = Boolean(
      response && !response.ok && response.code === 'DELIVERY_LOG_UNAVAILABLE',
    );
    const apiError =
      response && !response.ok && response.code !== 'DELIVERY_LOG_UNAVAILABLE'
        ? response.error
        : null;
    return { response, feed, unavailable, apiError };
  }, [query.data]);

  return Object.assign(query, derived);
}
