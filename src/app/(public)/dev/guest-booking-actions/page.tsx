import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';

import { enforceDevOnly } from '@/app/(public)/dev/_shared/enforceDevOnly';
import ReservationDetailClient from '@/components/features/booking/detail/ReservationDetailClient';
import { reservationKeys } from '@shared/api/queryKeys';

import type { Reservation } from '@entities/reservation/reservation.schema';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dev Guest Booking Actions · Nab a Table',
  robots: { index: false, follow: false },
};

const DEV_RESERVATION_ID = '33333333-3333-4333-8333-333333333333';

const devReservation: Reservation = {
  id: DEV_RESERVATION_ID,
  restaurantId: '22222222-2222-4222-8222-222222222222',
  restaurantName: 'Old Crown Girton',
  restaurantSlug: 'the-old-crown-girton',
  restaurantTimezone: 'Europe/London',
  bookingDate: '2026-04-29',
  startTime: '14:30:00',
  endTime: '16:00:00',
  startAt: '2026-04-29T13:30:00.000Z',
  endAt: '2026-04-29T15:00:00.000Z',
  partySize: 12,
  bookingType: 'lunch',
  seatingPreference: 'Any',
  status: 'confirmed',
  customerName: 'Aman Shrestha',
  customerEmail: 'aman@example.com',
  customerPhone: '+44 7700 900123',
  marketingOptIn: false,
  notes: 'Guest prefers a quiet table.',
  reference: 'JHZ98PYTHL',
  clientRequestId: null,
  idempotencyKey: null,
  pendingRef: null,
  metadata: null,
  createdAt: '2026-04-23T12:32:00.000Z',
  updatedAt: '2026-04-23T12:32:00.000Z',
};

export default function GuestBookingActionsDevPage() {
  enforceDevOnly();

  const queryClient = new QueryClient();
  queryClient.setQueryData(reservationKeys.detail(DEV_RESERVATION_ID), devReservation);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReservationDetailClient
        reservationId={DEV_RESERVATION_ID}
        restaurantName={devReservation.restaurantName ?? null}
        initialNow={Date.parse('2026-04-24T16:10:00.000Z')}
        canManage={false}
      />
    </HydrationBoundary>
  );
}
