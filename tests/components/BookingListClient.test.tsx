import { render, screen } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BookingListClient } from '@/components/features/booking/list/BookingListClient';

import type { BookingsPage } from '@/guest/services/ports';

const { useGuestBookingsMock, routerReplaceMock } = vi.hoisted(() => ({
  useGuestBookingsMock: vi.fn(),
  routerReplaceMock: vi.fn(),
}));

vi.mock('@/guest/hooks', () => ({
  useGuestBookings: useGuestBookingsMock,
}));

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation');
  return {
    ...actual,
    usePathname: () => '/guest/bookings',
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({
      replace: routerReplaceMock,
    }),
  };
});

function createBookingsPage(startIso: string): BookingsPage {
  return {
    items: [
      {
        id: 'booking-1',
        restaurantId: 'rest-1',
        restaurantName: 'White Horse',
        restaurantSlug: 'white-horse',
        restaurantTimezone: 'Europe/London',
        partySize: 2,
        startIso,
        endIso: '2026-07-01T20:00:00.000Z',
        status: 'confirmed',
        notes: null,
      },
    ],
    pageInfo: {
      page: 1,
      pageSize: 50,
      total: 1,
      hasNext: false,
    },
  };
}

describe('BookingListClient', () => {
  beforeEach(() => {
    // Pin the clock before the 2026-07-01 fixtures so groupBookingsByTimeline
    // buckets them as "upcoming" on any host date; shouldAdvanceTime keeps
    // testing-library's internal timers firing.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    useGuestBookingsMock.mockReturnValue({
      data: createBookingsPage('2026-07-01T18:30:00.000Z'),
      isLoading: false,
      isError: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders UTC booking times in the restaurant timezone', () => {
    const queryClient = createTestQueryClient();
    const QueryWrapper = createQueryWrapper(queryClient);

    render(
      <QueryWrapper>
        <BookingListClient initialTab="upcoming" />
      </QueryWrapper>,
    );

    expect(screen.getByText('19:30')).toBeInTheDocument();
    expect(screen.queryByText('18:30')).not.toBeInTheDocument();
  });

  it('keeps venue-local booking strings stable across devices', () => {
    useGuestBookingsMock.mockReturnValue({
      data: createBookingsPage('2026-07-01T19:30'),
      isLoading: false,
      isError: false,
    });

    const queryClient = createTestQueryClient();
    const QueryWrapper = createQueryWrapper(queryClient);

    render(
      <QueryWrapper>
        <BookingListClient initialTab="upcoming" />
      </QueryWrapper>,
    );

    expect(screen.getByText('19:30')).toBeInTheDocument();
  });
});
