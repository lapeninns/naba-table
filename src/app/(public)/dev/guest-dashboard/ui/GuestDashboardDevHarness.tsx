'use client';

import { GuestDashboardClient } from '@/components/features/guest/dashboard/GuestDashboardClient';
import { GuestServicesProvider } from '@/guest/services/di';

import type { BookingsPage, GuestServices } from '@/guest/services/ports';

const devBookings: BookingsPage = {
  items: [
    {
      id: 'guest-dashboard-next',
      restaurantId: 'rest-dev-old-crown',
      restaurantName: 'The Old Crown',
      restaurantSlug: 'old-crown',
      restaurantTimezone: 'Europe/London',
      partySize: 4,
      startIso: '2026-07-02T19:30',
      endIso: '2026-07-02T21:00',
      status: 'confirmed',
      notes: 'Dev harness booking for the guest dashboard next reservation state.',
    },
    {
      id: 'guest-dashboard-later',
      restaurantId: 'rest-dev-white-horse',
      restaurantName: 'White Horse',
      restaurantSlug: 'white-horse',
      restaurantTimezone: 'Europe/London',
      partySize: 2,
      startIso: '2026-07-18T18:00:00.000Z',
      endIso: '2026-07-18T19:30:00.000Z',
      status: 'confirmed',
      notes: 'UTC-backed booking should render in London time.',
    },
  ],
  pageInfo: {
    page: 1,
    pageSize: 10,
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
    getSelf: async () => ({ name: 'Aman' }) as never,
    ensureForUser: async () => ({ name: 'Aman' }) as never,
  },
};

export function GuestDashboardDevHarness() {
  return (
    <GuestServicesProvider services={services}>
      <GuestDashboardClient />
    </GuestServicesProvider>
  );
}
