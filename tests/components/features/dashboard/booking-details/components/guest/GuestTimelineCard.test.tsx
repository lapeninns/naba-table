import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GuestTimelineCard } from '@/components/features/dashboard/booking-details/components/guest/GuestTimelineCard';

import {
  PINNED_TIMEZONE,
  makeBooking,
} from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

describe('GuestTimelineCard', () => {
  it('@contract renders the four lifecycle steps for a confirmed booking', () => {
    render(
      <GuestTimelineCard
        status="confirmed"
        booking={makeBooking()}
        timezone={PINNED_TIMEZONE}
      />,
    );

    for (const label of ['Booked', 'Confirmed', 'Arrived', 'Finished']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText('Cancelled')).not.toBeInTheDocument();
    expect(screen.queryByText('No-show')).not.toBeInTheDocument();
  });

  it('@contract formats check-in and check-out times in the venue timezone', () => {
    // 17:05 UTC = 18:05 in Europe/London (BST on 2026-06-15).
    const { container } = render(
      <GuestTimelineCard
        status="completed"
        booking={makeBooking({
          checkedInAt: '2026-06-15T17:05:00.000Z',
          checkedOutAt: '2026-06-15T18:40:00.000Z',
        })}
        timezone={PINNED_TIMEZONE}
      />,
    );

    expect(within(container).getByText('18:05')).toBeInTheDocument();
    expect(within(container).getByText('19:40')).toBeInTheDocument();
  });

  it('@contract appends the danger step for a cancelled booking', () => {
    render(
      <GuestTimelineCard status="cancelled" booking={makeBooking()} timezone={PINNED_TIMEZONE} />,
    );

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('@contract appends the no-show step for a no-show booking', () => {
    render(
      <GuestTimelineCard status="no_show" booking={makeBooking()} timezone={PINNED_TIMEZONE} />,
    );

    expect(screen.getByText('No-show')).toBeInTheDocument();
  });
});
