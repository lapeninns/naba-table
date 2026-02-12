import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/keys';
import { buildGuestBookingsViewModel } from '@src/guest/routes/bookings/view-model';
import { buildGuestDashboardViewModel } from '@src/guest/routes/dashboard/view-model';
import { buildGuestProfileViewModel } from '@src/guest/routes/profile/view-model';
import { buildBookingsQueryKeyParams } from '@src/guest/services/bookings-params';

import type { ProfileResponse } from '@/lib/profile/schema';
import type { BookingsPage } from '@src/guest/services/ports';
import type { GuestServerServices } from '@src/guest/services/server';
import type { User } from '@supabase/supabase-js';

const mockUser = {
  id: 'user-1',
  email: 'guest@example.com',
} as User;

const mockBookings: BookingsPage = {
  items: [
    {
      id: 'booking-1',
      restaurantId: 'rest-1',
      restaurantName: 'The Fox',
      restaurantSlug: 'the-fox',
      restaurantTimezone: 'Europe/London',
      partySize: 2,
      startIso: '2026-02-10T19:00:00.000Z',
      endIso: '2026-02-10T20:30:00.000Z',
      status: 'confirmed',
      notes: null,
      customerName: 'Guest Booker',
      customerEmail: 'guest@example.com',
      customerPhone: '+14155552222',
    },
  ],
  pageInfo: {
    page: 1,
    pageSize: 10,
    total: 1,
    hasNext: false,
  },
};

const mockProfile: ProfileResponse = {
  id: 'profile-1',
  email: 'guest@example.com',
  name: 'Guest Booker',
  phone: '+14155552222',
  image: 'https://cdn.example.com/avatar.png',
  createdAt: '2026-02-01T10:00:00.000Z',
  updatedAt: '2026-02-01T10:00:00.000Z',
};

const createServices = (): GuestServerServices => {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(mockUser),
      requireUser: vi.fn().mockResolvedValue(mockUser),
    },
    bookings: {
      list: vi.fn().mockResolvedValue(mockBookings),
    },
    profile: {
      getSelf: vi.fn().mockResolvedValue(mockProfile),
      ensureForUser: vi.fn().mockResolvedValue(mockProfile),
    },
    supabasePromise: Promise.resolve({} as never),
  };
};

describe('guest view models', () => {
  it('prefetches bookings for the dashboard view model', async () => {
    const services = createServices();

    const viewModel = await buildGuestDashboardViewModel(services);

    expect(services.auth.requireUser).toHaveBeenCalledWith({
      redirectTo: '/auth/signin',
      redirectedFrom: '/guest/dashboard',
    });
    expect(services.bookings.list).toHaveBeenCalledWith({ page: 1, pageSize: 10 });

    const queryKey = queryKeys.bookings.list(
      buildBookingsQueryKeyParams({ page: 1, pageSize: 10 }),
    );
    expect(viewModel.dehydratedState.queries.map((query) => query.queryKey)).toContainEqual(
      queryKey,
    );
  });

  it('normalizes bookings tab and prefetches bookings list', async () => {
    const services = createServices();

    const viewModel = await buildGuestBookingsViewModel(services, { tab: 'history' });

    expect(services.auth.requireUser).toHaveBeenCalledWith({
      redirectTo: '/auth/signin',
      redirectedFrom: '/guest/bookings',
    });
    expect(services.bookings.list).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(viewModel.initialTab).toBe('past');
  });

  it('prefetches profile data for the profile view model', async () => {
    const services = createServices();

    const viewModel = await buildGuestProfileViewModel(services);

    expect(services.auth.requireUser).toHaveBeenCalledWith({
      redirectTo: '/auth/signin',
      redirectedFrom: '/guest/profile',
    });
    expect(services.profile.ensureForUser).toHaveBeenCalledWith(mockUser);
    expect(viewModel.profile).toEqual(mockProfile);
    expect(viewModel.dehydratedState.queries.map((query) => query.queryKey)).toContainEqual(
      queryKeys.profile.self(),
    );
  });
});
