'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useBookingService } from '@/contexts/ops-services';

import type { HttpError } from '@/lib/http/errors';
import type {
  OpsEmailQueueFeedResponse,
  OpsEmailQueueJobDTO,
  OpsEmailQueueJobStatus,
  OpsEmailQueueSummary,
} from '@/types/emailQueue';

export type OpsEmailQueueFeedState = {
  response: OpsEmailQueueFeedResponse | null;
  jobs: OpsEmailQueueJobDTO[] | null;
  summary: OpsEmailQueueSummary | null;
  apiError: Extract<OpsEmailQueueFeedResponse, { ok: false }> | null;
};

export type OpsEmailQueueFeedParams = {
  restaurantId: string | null;
  page?: number;
  pageSize?: number;
  status?: OpsEmailQueueJobStatus;
  enabled?: boolean;
  refetchIntervalMs?: number | false;
};

function normalizePage(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
  return Math.max(1, Math.floor(raw));
}

function normalizePageSize(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 25;
  return Math.max(1, Math.min(100, Math.floor(raw)));
}

export function useOpsEmailQueueFeed(
  params: OpsEmailQueueFeedParams,
): UseQueryResult<OpsEmailQueueFeedResponse, HttpError> & OpsEmailQueueFeedState {
  const bookingService = useBookingService();
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const enabled = params.enabled ?? true;
  const refetchInterval = typeof params.refetchIntervalMs === 'number' ? params.refetchIntervalMs : false;

  const query = useQuery<OpsEmailQueueFeedResponse, HttpError>({
    queryKey: [
      'ops',
      'email-queue',
      params.restaurantId ?? 'disabled',
      page,
      pageSize,
      params.status ?? 'all',
    ] as const,
    queryFn: () => {
      if (!params.restaurantId) {
        throw new Error('Restaurant ID is required');
      }
      return bookingService.getRestaurantEmailQueue({
        restaurantId: params.restaurantId,
        page,
        pageSize,
        status: params.status,
      });
    },
    enabled: Boolean(params.restaurantId) && enabled,
    staleTime: 30_000,
    refetchInterval,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
  });

  const derived = useMemo<OpsEmailQueueFeedState>(() => {
    const response = query.data ?? null;
    const jobs = response && response.ok ? response.jobs : null;
    const summary = response && response.ok ? response.summary : null;
    const apiError = response && response.ok === false ? response : null;
    return {
      response,
      jobs,
      summary,
      apiError,
    };
  }, [query.data]);

  return Object.assign(query, derived);
}
