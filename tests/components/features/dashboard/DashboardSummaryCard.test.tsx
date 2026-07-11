import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { bookingsListSpy } = vi.hoisted(() => ({
  bookingsListSpy: vi.fn(() => <div data-testid="bookings-list" />),
}));

vi.mock('@/components/features/dashboard/BookingsList', () => ({
  BookingsList: bookingsListSpy,
}));

import { DashboardSummaryCard } from '@/components/features/dashboard/DashboardSummaryCard';
import { getEmptyBookingTabCounts } from '@/components/features/dashboard/bookingFilters';

import {
  PINNED_NOW_ISO,
  makeSummary,
} from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { DashboardBookingActionHandlers, DashboardListControls } from '@/components/features/dashboard/types';
import type { OpsTodayBookingsSummary } from '@/types/ops';

function makeControls(overrides: Partial<DashboardListControls> = {}): DashboardListControls {
  return {
    filter: 'all',
    tabCounts: getEmptyBookingTabCounts(),
    searchQuery: '',
    deferredSearchQuery: '',
    sortKey: 'time',
    sortDir: 'asc',
    onFilterChange: vi.fn(),
    onSearchChange: vi.fn(),
    onPrint: vi.fn(),
    onSortKeyChange: vi.fn(),
    onSortDirChange: vi.fn(),
    ...overrides,
  };
}

function makeActions(): DashboardBookingActionHandlers {
  return {
    onMarkNoShow: vi.fn(async () => {}),
    onUndoNoShow: vi.fn(async () => {}),
    onCheckIn: vi.fn(async () => {}),
    onCheckOut: vi.fn(async () => {}),
  };
}

function renderCard(
  overrides: Partial<Parameters<typeof DashboardSummaryCard>[0]> = {},
) {
  const props = {
    summary: makeSummary(),
    restaurantName: 'Old Crown',
    controls: makeControls(),
    bookingActions: makeActions(),
    initialNowIso: PINNED_NOW_ISO,
    ...overrides,
  };
  render(<DashboardSummaryCard {...props} />);
  return props;
}

describe('DashboardSummaryCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(PINNED_NOW_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract renders the bookings card with toolbar and the (lazy) list', async () => {
    renderCard();

    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText(/Active reservations for Old Crown/)).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search guests' })).toBeInTheDocument();
    expect(await screen.findByTestId('bookings-list')).toBeInTheDocument();
  });

  it('@contract derives allowTableAssignments=true for today when not overridden', async () => {
    // Pinned clock: today in Europe/London is 2026-06-15 (the summary date).
    renderCard();

    await screen.findByTestId('bookings-list');
    const forwarded = bookingsListSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(forwarded.allowTableAssignments).toBe(true);
  });

  it('@contract derives allowTableAssignments=false for a past date', async () => {
    renderCard({ summary: makeSummary({ date: '2026-06-14' }) });

    await screen.findByTestId('bookings-list');
    const forwarded = bookingsListSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(forwarded.allowTableAssignments).toBe(false);
  });

  it('@contract an explicit allowTableAssignments override wins over the date heuristic', async () => {
    renderCard({
      summary: makeSummary({ date: '2026-06-14' }),
      allowTableAssignments: true,
    });

    await screen.findByTestId('bookings-list');
    const forwarded = bookingsListSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(forwarded.allowTableAssignments).toBe(true);
  });

  it('@contract prefers the deferred search query for the list while the toolbar stays live', async () => {
    renderCard({
      controls: makeControls({ searchQuery: 'ali', deferredSearchQuery: 'al' }),
    });

    expect(screen.getByRole('searchbox', { name: 'Search guests' })).toHaveValue('ali');
    await screen.findByTestId('bookings-list');
    const forwarded = bookingsListSpy.mock.calls.at(-1)?.[0] as {
      controls: { searchQuery?: string };
    };
    expect(forwarded.controls.searchQuery).toBe('al');
  });

  it('@contract renders the unavailable alert when the summary is missing', () => {
    renderCard({
      summary: null as unknown as OpsTodayBookingsSummary,
      allowTableAssignments: true,
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Bookings unavailable');
    expect(screen.queryByTestId('bookings-list')).not.toBeInTheDocument();
  });
});
