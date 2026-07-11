import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cardSpy } = vi.hoisted(() => ({
  cardSpy: vi.fn(({ viewModel }: { viewModel: { header: { customerLabel: string } } }) => (
    <div data-testid="booking-card">{viewModel.header.customerLabel}</div>
  )),
}));

vi.mock('@/components/features/dashboard/cards/OpsBookingCard', () => ({
  OpsBookingCard: cardSpy,
}));

import { BookingsListVirtualized } from '@/components/features/dashboard/list/BookingsListVirtualized';

import {
  PINNED_NOW_ISO,
  installStableMatchMedia,
  makeBooking,
  makeSummary,
} from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { OpsTodayBooking } from '@/types/ops';

// framer-motion's useReducedMotion consumes the MediaQueryList on first render;
// the setup.ts vi.fn() mock is wiped by mockReset, so pin a stable one.
installStableMatchMedia();

function renderVirtualized(bookings: OpsTodayBooking[]) {
  return render(
    <BookingsListVirtualized
      sorted={bookings}
      summary={makeSummary({ bookings })}
      nowDate={new Date(PINNED_NOW_ISO)}
      bookingActions={{}}
    />,
  );
}

describe('BookingsListVirtualized', () => {
  beforeEach(() => {
    // Neutralize the idle-time dialog-chunk warm-up: its dynamic imports pull
    // modules that are unresolvable under the vitest alias map (see
    // attemptImport in the shared fixtures) and would reject after the test.
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 1),
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  it('@contract renders every row directly below the virtualization threshold', () => {
    renderVirtualized([
      makeBooking({ id: 'b1', customerName: 'First Guest' }),
      makeBooking({ id: 'b2', customerName: 'Second Guest' }),
      makeBooking({ id: 'b3', customerName: 'Third Guest' }),
    ]);

    expect(screen.getAllByTestId('booking-card')).toHaveLength(3);
    expect(screen.getByText('First Guest')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Bookings list' })).not.toBeInTheDocument();
  });

  it('@contract builds the card view model from the booking and summary', () => {
    renderVirtualized([
      makeBooking({ id: 'b1', customerName: 'Priya Patel', partySize: 5, startTime: null }),
    ]);

    const forwarded = cardSpy.mock.calls.at(-1)?.[0] as {
      viewModel: {
        header: { customerLabel: string; partySizeLabel: string; timeRangeLabel: string };
      };
    };
    expect(forwarded.viewModel.header.customerLabel).toBe('Priya Patel');
    expect(forwarded.viewModel.header.partySizeLabel).toMatch(/5/);
    // startTime null → the explicit Time TBD override.
    expect(forwarded.viewModel.header.timeRangeLabel).toBe('Time TBD');
  });

  it('@contract switches to the scrollable virtualized region at 24+ bookings', () => {
    const bookings = Array.from({ length: 30 }, (_, index) =>
      makeBooking({ id: `b${index}`, customerName: `Guest ${index}` }),
    );

    renderVirtualized(bookings);

    expect(screen.getByRole('region', { name: 'Bookings list' })).toBeInTheDocument();
    // Virtualization renders only the measured window, never the full set.
    expect(screen.queryAllByTestId('booking-card').length).toBeLessThan(30);
  });
});
