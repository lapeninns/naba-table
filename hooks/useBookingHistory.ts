'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchJson } from '@/lib/http/fetchJson';
import type { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';
import type { BookingHistoryEvent } from '@/types/bookingHistory';

type BookingHistoryResponse = {
  events: BookingHistoryEvent[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
};

export function useBookingHistory(id: string | undefined): UseQueryResult<BookingHistoryResponse, HttpError> {
  return useQuery({
    queryKey: queryKeys.bookings.history(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) {
        throw new Error('Reservation id is required');
      }
      return fetchJson<BookingHistoryResponse>(`/api/bookings/${id}/history`);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
