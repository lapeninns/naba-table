'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useBookingService } from '@/contexts/ops-services';

import type { HttpError } from '@/lib/http/errors';
import type { BookingSmsDeliveryResponse, SmsDeliveryEventDTO } from '@/types/smsDelivery';

export type OpsBookingSmsDeliveryLogState = {
  response: BookingSmsDeliveryResponse | null;
  events: SmsDeliveryEventDTO[] | null;
  unavailable: boolean;
  apiError: Extract<BookingSmsDeliveryResponse, { ok: false }> | null;
};

export function useOpsBookingSmsDeliveryLog(
  bookingId: string | null,
  options?: { limit?: number; enabled?: boolean },
): UseQueryResult<BookingSmsDeliveryResponse, HttpError> & OpsBookingSmsDeliveryLogState {
  const bookingService = useBookingService();
  const rawLimit = options?.limit;
  const limit =
    typeof rawLimit === 'number' && Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20;
  const clamped = Math.max(1, Math.min(200, limit));
  const isEnabled = Boolean(bookingId) && (options?.enabled ?? true);

  const query = useQuery<BookingSmsDeliveryResponse, HttpError>({
    queryKey: ['ops', 'bookings', bookingId ?? 'disabled', 'sms-delivery', clamped] as const,
    queryFn: () => {
      if (!bookingId) {
        throw new Error('Booking ID is required');
      }
      return bookingService.getBookingSmsDeliveryLog(bookingId, { limit: clamped });
    },
    enabled: isEnabled,
    staleTime: 5 * 60_000,
  });

  const derived = useMemo<OpsBookingSmsDeliveryLogState>(() => {
    const response = query.data ?? null;
    const unavailable = Boolean(
      response && response.ok === false && response.code === 'DELIVERY_LOG_UNAVAILABLE',
    );
    const events = response && response.ok ? response.events : null;
    const apiError = response && response.ok === false && !unavailable ? response : null;
    return { response, events, unavailable, apiError };
  }, [query.data]);

  return Object.assign(query, derived);
}
