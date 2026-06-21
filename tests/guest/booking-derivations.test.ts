import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildGuestDashboardFeaturedBookingDisplay,
  buildGuestDashboardUpcomingBookingDisplay,
  deriveBookingState,
  deriveGuestDashboardViewState,
  formatGuestDashboardBookingStatus,
  formatGuestDashboardPartyLabel,
  resolveGuestDashboardHeroName,
} from '@/components/features/guest/dashboard/booking-derivations';

import type { BookingDTO } from '@/guest/services/ports';

function createBooking(overrides: Partial<BookingDTO> = {}): BookingDTO {
  return {
    id: overrides.id ?? 'booking-1',
    restaurantName: overrides.restaurantName ?? 'White Horse',
    restaurantSlug: overrides.restaurantSlug ?? 'white-horse',
    restaurantTimezone: overrides.restaurantTimezone ?? 'Europe/London',
    partySize: overrides.partySize ?? 2,
    startIso: overrides.startIso ?? '2026-07-01T19:30',
    endIso: overrides.endIso ?? '2026-07-01T21:00',
    status: overrides.status ?? 'confirmed',
    notes: overrides.notes ?? null,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('deriveBookingState', () => {
  it('classifies venue-local timestamps consistently for next booking selection', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T17:00:00.000Z'));

    const state = deriveBookingState([
      createBooking({ id: 'later', startIso: '2026-07-01T20:30', endIso: '2026-07-01T22:00' }),
      createBooking({ id: 'next', startIso: '2026-07-01T19:30', endIso: '2026-07-01T21:00' }),
    ]);

    expect(state.nextBooking?.id).toBe('next');
    expect(state.liveBooking).toBeNull();
  });
});

describe('deriveGuestDashboardViewState', () => {
  it('selects the primary booking and sorted secondary upcoming list', () => {
    const state = deriveGuestDashboardViewState({
      bookings: [
        createBooking({
          id: 'later',
          startIso: '2026-07-01T21:00',
          endIso: '2026-07-01T22:30',
        }),
        createBooking({
          id: 'completed',
          startIso: '2026-07-01T20:00',
          endIso: '2026-07-01T21:30',
          status: 'completed',
        }),
        createBooking({
          id: 'primary',
          startIso: '2026-07-01T19:30',
          endIso: '2026-07-01T21:00',
        }),
        createBooking({
          id: 'past',
          startIso: '2026-07-01T16:00',
          endIso: '2026-07-01T17:00',
        }),
      ],
      now: new Date('2026-07-01T17:00:00.000Z'),
      profile: { name: 'Profile Guest' },
      user: {
        email: 'guest@example.com',
        user_metadata: { full_name: 'Alex Rivera' },
      },
    });

    expect(state.heroName).toBe('Alex Rivera');
    expect(state.firstName).toBe('Alex');
    expect(state.primaryBooking?.id).toBe('primary');
    expect(state.upcomingList.map((booking) => booking.id)).toEqual(['later']);
  });
});

describe('resolveGuestDashboardHeroName', () => {
  it('uses metadata, profile, email, then Guest as the fallback order', () => {
    expect(
      resolveGuestDashboardHeroName({
        profile: { name: 'Profile Guest' },
        user: {
          email: 'guest@example.com',
          user_metadata: { full_name: 'Alex Rivera' },
        },
      }),
    ).toBe('Alex Rivera');

    expect(
      resolveGuestDashboardHeroName({
        profile: { name: 'Profile Guest' },
        user: { email: 'guest@example.com', user_metadata: null },
      }),
    ).toBe('Profile Guest');

    expect(
      resolveGuestDashboardHeroName({
        profile: null,
        user: { email: 'guest@example.com', user_metadata: null },
      }),
    ).toBe('guest');

    expect(resolveGuestDashboardHeroName({ profile: null, user: null })).toBe('Guest');
  });
});

describe('formatGuestDashboardBookingStatus', () => {
  it('formats booking statuses for guest dashboard chips', () => {
    expect(formatGuestDashboardBookingStatus('no_show')).toBe('No Show');
    expect(formatGuestDashboardBookingStatus('PRIORITY_WAITLIST')).toBe('PRIORITY WAITLIST');
  });
});

describe('formatGuestDashboardPartyLabel', () => {
  it('formats singular and plural dashboard party labels', () => {
    expect(formatGuestDashboardPartyLabel(1)).toBe('1 guest');
    expect(formatGuestDashboardPartyLabel(2)).toBe('2 guests');
  });
});

describe('guest dashboard display derivation', () => {
  it('builds featured booking labels with venue-local today detection', () => {
    expect(
      buildGuestDashboardFeaturedBookingDisplay({
        booking: createBooking({
          partySize: 4,
          startIso: '2026-07-01T19:30',
          status: 'checked_in',
        }),
        now: new Date('2026-07-01T17:00:00.000Z'),
      }),
    ).toEqual({
      dateLabel: 'Wednesday, 1 July 2026',
      isToday: true,
      partyLabel: '4 guests',
      statusLabel: 'Checked In',
      timeLabel: '19:30',
    });
  });

  it('builds upcoming booking card labels with pending fallbacks', () => {
    expect(
      buildGuestDashboardUpcomingBookingDisplay(
        createBooking({
          partySize: 3,
          startIso: '2026-07-01T19:30',
        }),
      ),
    ).toEqual({
      dayLabel: '1',
      monthLabel: 'Jul',
      partyLabel: '3 guests',
      timeLabel: '19:30',
    });

    expect(
      buildGuestDashboardUpcomingBookingDisplay(
        createBooking({
          startIso: null,
        }),
      ),
    ).toMatchObject({
      dayLabel: '--',
      monthLabel: 'TBC',
      timeLabel: 'Time pending',
    });
  });
});
