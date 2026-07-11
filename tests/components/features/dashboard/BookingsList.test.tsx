import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { virtualizedSpy, controlsSpy } = vi.hoisted(() => ({
  virtualizedSpy: vi.fn(() => <div data-testid="virtualized-list" />),
  controlsSpy: vi.fn(() => <div data-testid="list-controls" />),
}));

vi.mock('@/components/features/dashboard/list/BookingsListVirtualized', () => ({
  BookingsListVirtualized: virtualizedSpy,
}));
// KNOWN-ISSUE (test-infra): list/BookingsListControls.tsx imports
// '@/hooks/use-minimum-delay', which vitest's '@' → repo-root alias cannot
// resolve (the hook exists only in src/hooks/), so importing the real child
// fails at transform time. Factory-mocking the child keeps BookingsList itself
// testable; the child has its own pinned suite in list/BookingsListControls.test.tsx.
vi.mock('@/components/features/dashboard/list/BookingsListControls', () => ({
  BookingsListControls: controlsSpy,
}));

import { BookingsList } from '@/components/features/dashboard/BookingsList';

import {
  PINNED_NOW_ISO,
  makeBooking,
  makeSummary,
} from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { DashboardBookingActionHandlers } from '@/components/features/dashboard/types';
import type { OpsTodayBooking } from '@/types/ops';

function makeActions(): DashboardBookingActionHandlers {
  return {
    onMarkNoShow: vi.fn(async () => {}),
    onUndoNoShow: vi.fn(async () => {}),
    onCheckIn: vi.fn(async () => {}),
    onCheckOut: vi.fn(async () => {}),
  };
}

function renderList(params: {
  bookings: OpsTodayBooking[];
  filter?: 'all' | 'upcoming' | 'seated' | 'attention' | 'finished' | 'no_show';
  searchQuery?: string;
  sortDir?: 'asc' | 'desc';
}) {
  const bookings = params.bookings;
  const summary = makeSummary({ bookings });
  const controls = {
    filter: params.filter ?? ('all' as const),
    searchQuery: params.searchQuery,
    sortKey: 'time' as const,
    sortDir: params.sortDir ?? ('asc' as const),
    onSortKeyChange: vi.fn(),
    onSortDirChange: vi.fn(),
  };
  render(
    <BookingsList
      bookings={bookings}
      controls={controls}
      bookingActions={makeActions()}
      summary={summary}
      initialNowIso={PINNED_NOW_ISO}
      allowTableAssignments
    />,
  );
  return controls;
}

describe('BookingsList', () => {
  it('@contract renders the empty state when no booking matches the filter', () => {
    renderList({
      bookings: [makeBooking({ id: 'b1', status: 'confirmed' })],
      filter: 'seated',
    });

    expect(screen.getByText('No bookings found')).toBeInTheDocument();
    expect(screen.getByText('Adjust filters to see more results.')).toBeInTheDocument();
    expect(screen.queryByTestId('virtualized-list')).not.toBeInTheDocument();
  });

  it('@contract renders the empty state when the search matches nothing', () => {
    renderList({
      bookings: [makeBooking({ id: 'b1', customerName: 'Alex Example' })],
      searchQuery: 'zebra',
    });

    expect(screen.getByText('No bookings found')).toBeInTheDocument();
  });

  it('@contract renders the sort controls and the list body for matching bookings', () => {
    const controls = renderList({ bookings: [makeBooking({ id: 'b1' })] });

    expect(screen.getByTestId('list-controls')).toBeInTheDocument();
    expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();

    const forwarded = controlsSpy.mock.calls.at(-1)?.[0] as {
      sortKey: string;
      sortDir: string;
      onSortKeyChange: unknown;
      onSortDirChange: unknown;
    };
    expect(forwarded.sortKey).toBe('time');
    expect(forwarded.sortDir).toBe('asc');
    expect(forwarded.onSortKeyChange).toBe(controls.onSortKeyChange);
    expect(forwarded.onSortDirChange).toBe(controls.onSortDirChange);
  });

  it('@contract passes bookings sorted by time ascending to the list body', () => {
    renderList({
      bookings: [
        makeBooking({ id: 'late', startTime: '20:00', customerName: 'Late Guest' }),
        makeBooking({ id: 'early', startTime: '12:00', customerName: 'Early Guest' }),
        makeBooking({ id: 'mid', startTime: '17:00', customerName: 'Mid Guest' }),
      ],
    });

    const forwarded = virtualizedSpy.mock.calls.at(-1)?.[0] as {
      sorted: OpsTodayBooking[];
    };
    expect(forwarded.sorted.map((booking) => booking.id)).toEqual(['early', 'mid', 'late']);
  });

  it('@contract keeps the All view in timeline order but applies sort direction within completed bookings', () => {
    // Documented design (list/utils.ts sortBookingsGrouped): the "All" filter is
    // a timeline merge — active bookings interleave by their next event time
    // regardless of sortDir; completed bookings always sink to the bottom, and
    // sortKey/sortDir order that completed group (and break timeline ties).
    renderList({
      bookings: [
        makeBooking({ id: 'active-late', startTime: '20:00' }),
        makeBooking({ id: 'active-early', startTime: '18:00' }),
        makeBooking({ id: 'done-early', startTime: '12:00', status: 'completed' }),
        makeBooking({ id: 'done-late', startTime: '14:00', status: 'completed' }),
      ],
      sortDir: 'desc',
    });

    const forwarded = virtualizedSpy.mock.calls.at(-1)?.[0] as {
      sorted: OpsTodayBooking[];
    };
    expect(forwarded.sorted.map((booking) => booking.id)).toEqual([
      'active-early',
      'active-late',
      'done-late',
      'done-early',
    ]);
  });

  it('@contract filters by guest-name search before rendering', () => {
    renderList({
      bookings: [
        makeBooking({ id: 'match', customerName: 'Priya Match' }),
        makeBooking({ id: 'other', customerName: 'Alex Other' }),
      ],
      searchQuery: 'priya',
    });

    const forwarded = virtualizedSpy.mock.calls.at(-1)?.[0] as {
      sorted: OpsTodayBooking[];
    };
    expect(forwarded.sorted.map((booking) => booking.id)).toEqual(['match']);
  });
});
