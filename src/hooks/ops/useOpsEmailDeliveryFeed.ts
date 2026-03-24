'use client';

import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useBookingService } from '@/contexts/ops-services';

import type { HttpError } from '@/lib/http/errors';
import type {
  EmailDeliveryStatus,
  OpsEmailDeliveryAttemptDTO,
  OpsEmailDeliverySummary,
  OpsEmailDeliveryFeedResponse,
  OpsEmailDeliveryRange,
} from '@/types/emailDelivery';

export type OpsEmailDeliveryFeedState = {
  response: OpsEmailDeliveryFeedResponse | null;
  attempts: OpsEmailDeliveryAttemptDTO[] | null;
  summary: OpsEmailDeliverySummary | null;
  isSummaryLoading: boolean;
  isSummaryUpdating: boolean;
  unavailable: boolean;
  apiError: Extract<OpsEmailDeliveryFeedResponse, { ok: false }> | null;
};

export type OpsEmailDeliveryFeedParams = {
  restaurantId: string | null;
  range?: OpsEmailDeliveryRange;
  page?: number;
  pageSize?: number;
  status?: EmailDeliveryStatus[];
  refetchIntervalMs?: number | false;
  simulateEmailDeliveryError?: boolean;
  recipientEmail?: string;
  messageId?: string;
  bookingRef?: string;
  templateType?: string;
  emailType?: string;
};

function normalizePage(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
  return Math.max(1, Math.floor(raw));
}

function normalizePageSize(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 50;
  return Math.max(1, Math.min(200, Math.floor(raw)));
}

export function useOpsEmailDeliveryFeed(
  params: OpsEmailDeliveryFeedParams,
): UseQueryResult<OpsEmailDeliveryFeedResponse, HttpError> & OpsEmailDeliveryFeedState {
  const bookingService = useBookingService();

  const restaurantId = params.restaurantId;
  const range: OpsEmailDeliveryRange = params.range ?? '7d';
  const page = normalizePage(params.page);
  const pageSize = normalizePageSize(params.pageSize);
  const statusKey = params.status?.length ? params.status.slice().sort().join(',') : 'all';
  const refetchInterval = typeof params.refetchIntervalMs === 'number' ? params.refetchIntervalMs : false;

  const query = useQuery<OpsEmailDeliveryFeedResponse, HttpError>({
    queryKey: [
      'ops',
      'email-delivery',
      restaurantId ?? 'disabled',
      range,
      page,
      pageSize,
      statusKey,
      params.simulateEmailDeliveryError ? 'forced-error' : '',
      params.recipientEmail?.trim() ?? '',
      params.messageId?.trim() ?? '',
      params.bookingRef?.trim().toUpperCase() ?? '',
      params.templateType?.trim() ?? '',
      params.emailType?.trim() ?? '',
    ] as const,
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant ID is required');
      }
      return bookingService.getRestaurantEmailDeliveryFeed({
        restaurantId,
        range,
        page,
        pageSize,
        status: params.status,
        simulateEmailDeliveryError: params.simulateEmailDeliveryError,
        recipientEmail: params.recipientEmail,
        messageId: params.messageId,
        bookingRef: params.bookingRef,
        templateType: params.templateType,
        emailType: params.emailType,
      });
    },
    enabled: Boolean(restaurantId),
    staleTime: 30_000,
    refetchInterval,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });

  const derived = useMemo<OpsEmailDeliveryFeedState>(() => {
    const response = query.data ?? null;
    const unavailable = Boolean(
      response && response.ok === false && response.code === 'DELIVERY_LOG_UNAVAILABLE',
    );
    const attempts = response && response.ok ? response.attempts : null;
    const summary = response && response.ok ? response.summary ?? null : null;
    const isSummaryLoading = Boolean(query.isLoading && !summary);
    const isSummaryUpdating = Boolean(query.isFetching && !query.isLoading && Boolean(summary));
    const apiError = response && response.ok === false && !unavailable ? response : null;
    return {
      response,
      attempts,
      summary,
      isSummaryLoading,
      isSummaryUpdating,
      unavailable,
      apiError,
    };
  }, [query.data, query.isFetching, query.isLoading]);

  return Object.assign(query, derived);
}
