'use client';

import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';
import type {
  OpsEmailDeliverySummary,
  OpsEmailDeliverySummaryResponse,
  OpsEmailDeliveryRange,
} from '@/types/emailDelivery';

export type OpsEmailDeliverySummaryState = {
  response: OpsEmailDeliverySummaryResponse | null;
  summary: OpsEmailDeliverySummary | null;
  unavailable: boolean;
  apiError: Extract<OpsEmailDeliverySummaryResponse, { ok: false }> | null;
};

export type OpsEmailDeliverySummaryParams = {
  restaurantId: string | null;
  range?: OpsEmailDeliveryRange;
  refetchIntervalMs?: number | false;
  simulateEmailDeliveryError?: boolean;
  recipientEmail?: string;
  messageId?: string;
  bookingRef?: string;
  templateType?: string;
  emailType?: string;
};

export function useOpsEmailDeliverySummary(
  params: OpsEmailDeliverySummaryParams,
): UseQueryResult<OpsEmailDeliverySummaryResponse, HttpError> & OpsEmailDeliverySummaryState {
  const bookingService = useBookingService();

  const restaurantId = params.restaurantId;
  const range: OpsEmailDeliveryRange = params.range ?? '7d';
  const refetchInterval =
    typeof params.refetchIntervalMs === 'number' ? params.refetchIntervalMs : false;

  const query = useQuery<OpsEmailDeliverySummaryResponse, HttpError>({
    queryKey: queryKeys.opsEmailDelivery.summary({
      restaurantId,
      range,
      simulateEmailDeliveryError: params.simulateEmailDeliveryError,
      recipientEmail: params.recipientEmail,
      messageId: params.messageId,
      bookingRef: params.bookingRef,
      templateType: params.templateType,
      emailType: params.emailType,
    }),
    queryFn: () => {
      if (!restaurantId) {
        throw new Error('Restaurant ID is required');
      }
      return bookingService.getRestaurantEmailDeliverySummary({
        restaurantId,
        range,
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

  const derived = useMemo<OpsEmailDeliverySummaryState>(() => {
    const response = query.data ?? null;
    const unavailable = Boolean(
      response && response.ok === false && response.code === 'DELIVERY_LOG_UNAVAILABLE',
    );
    const summary = response && response.ok ? response.summary : null;
    const apiError = response && response.ok === false && !unavailable ? response : null;

    return {
      response,
      summary,
      unavailable,
      apiError,
    };
  }, [query.data]);

  return Object.assign(query, derived);
}
