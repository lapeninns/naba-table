import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';

import { enforceDevOnly } from '@/app/(public)/dev/_shared/enforceDevOnly';
import { ReceiptClient } from '@/app/guest/bookings/[bookingId]/receipt/ReceiptClient';
import { reservationKeys } from '@shared/api/queryKeys';

import type { Reservation } from '@entities/reservation/reservation.schema';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dev Guest Receipt · Nab a Table',
  robots: { index: false, follow: false },
};

const DEV_RESERVATION_ID = '11111111-1111-4111-8111-111111111111';

const devReservation: Reservation = {
  id: DEV_RESERVATION_ID,
  restaurantId: '22222222-2222-4222-8222-222222222222',
  restaurantName: 'Radix Luma Dining Room',
  restaurantSlug: 'radix-luma-dining-room',
  restaurantTimezone: 'Europe/London',
  bookingDate: '2026-04-25',
  startTime: '19:30:00',
  endTime: '21:00:00',
  startAt: '2026-04-25T18:30:00.000Z',
  endAt: '2026-04-25T20:00:00.000Z',
  partySize: 4,
  bookingType: 'dinner',
  status: 'confirmed',
  customerName: 'Aman Shrestha',
  customerEmail: 'aman@example.com',
  customerPhone: '+44 7700 900123',
  marketingOptIn: false,
  notes: 'Guest prefers a quiet table.',
  reference: 'NAB-5821',
  clientRequestId: null,
  idempotencyKey: null,
  pendingRef: null,
  metadata: null,
  createdAt: '2026-04-23T12:32:00.000Z',
  updatedAt: '2026-04-23T12:32:00.000Z',
};

export default function GuestReceiptDevHarnessPage() {
  enforceDevOnly();

  const queryClient = new QueryClient();
  queryClient.setQueryData(reservationKeys.detail(DEV_RESERVATION_ID), devReservation);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReceiptClient
        reservationId={DEV_RESERVATION_ID}
        hasSession
        prefetchedStatus={devReservation.status}
      />
    </HydrationBoundary>
  );
}
