'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useBookingService } from '@/contexts/ops-services';
import { queryKeys } from '@/lib/query/keys';

import type { HttpError } from '@/lib/http/errors';
import type { OpsBookingListItem } from '@/types/ops';

export function useOpsBooking(bookingId: string | null): UseQueryResult<OpsBookingListItem, HttpError> {
    const bookingService = useBookingService();

    return useQuery<OpsBookingListItem, HttpError>({
        queryKey: bookingId ? queryKeys.opsBookings.detail(bookingId) : ['ops', 'bookings', 'detail', 'disabled'],
        queryFn: () => {
            if (!bookingId) throw new Error('Booking ID is required');
            return bookingService.getBooking(bookingId);
        },
        enabled: Boolean(bookingId),
        staleTime: 60_000,
    });
}
