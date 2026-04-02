'use client';

import { BookingListClient } from '@/components/features/booking/list/BookingListClient';
import { GuestServicesProvider } from '@/guest/services/di';

import type { BookingsPage, GuestServices } from '@/guest/services/ports';

const devBookings: BookingsPage = {
  items: [
    {
      id: 'guest-dev-utc',
      restaurantId: 'rest-dev',
      restaurantName: 'White Horse',
      restaurantSlug: 'white-horse',
      restaurantTimezone: 'Europe/London',
      partySize: 2,
      startIso: '2026-07-01T18:30:00.000Z',
      endIso: '2026-07-01T20:00:00.000Z',
      status: 'confirmed',
      notes: 'UTC-backed booking should render as 19:30 in London.',
    },
    {
      id: 'guest-dev-local',
      restaurantId: 'rest-dev',
      restaurantName: 'Old Crown',
      restaurantSlug: 'old-crown',
      restaurantTimezone: 'Europe/London',
      partySize: 4,
      startIso: '2026-07-02T19:30',
      endIso: '2026-07-02T21:00',
      status: 'confirmed',
      notes: 'Venue-local booking string should stay 19:30 on any device.',
    },
  ],
  pageInfo: {
    page: 1,
    pageSize: 50,
    total: 2,
    hasNext: false,
  },
};

const services: GuestServices = {
  auth: {
    getUser: async () => null,
    requireUser: async () => {
      throw new Error('Guest auth is not available in the dev harness.');
    },
  },
  bookings: {
    list: async () => devBookings,
  },
  profile: {
    getSelf: async () => ({}) as never,
    ensureForUser: async () => ({}) as never,
  },
};

export function GuestBookingsDevHarness() {
  return (
    <GuestServicesProvider services={services}>
      <BookingListClient initialTab="upcoming" />
    </GuestServicesProvider>
  );
}
