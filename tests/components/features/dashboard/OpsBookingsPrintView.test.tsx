import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { useOpsDashboardDataMock, useOpsActiveMembershipMock, navigation } = vi.hoisted(() => {
  const cache = new Map<string, URLSearchParams>();
  const router = { replace: vi.fn() };
  return {
    useOpsDashboardDataMock: vi.fn(),
    useOpsActiveMembershipMock: vi.fn(),
    navigation: {
      search: '',
      router,
      params(search: string) {
        if (!cache.has(search)) cache.set(search, new URLSearchParams(search));
        return cache.get(search)!;
      },
    },
  };
});

vi.mock('@/hooks/ops/useOpsDashboardData', () => ({
  useOpsDashboardData: useOpsDashboardDataMock,
}));
vi.mock('@/contexts/ops-session', () => ({
  useOpsActiveMembership: useOpsActiveMembershipMock,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/dashboard/print',
  useRouter: () => navigation.router,
  useSearchParams: () => navigation.params(navigation.search),
}));

import { OpsBookingsPrintView } from '@/components/features/dashboard/OpsBookingsPrintView';
import {
  PINNED_DATE_KEY,
  makeBooking,
  makeSummary,
} from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { OpsTodayBookingsSummary } from '@/types/ops';

function mockSummaryQuery(overrides: {
  summary?: OpsTodayBookingsSummary | null;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
}) {
  const summary = overrides.summary ?? null;
  useOpsDashboardDataMock.mockReturnValue({
    data: summary ?? undefined,
    summary,
    dataUpdatedAt: summary ? Date.parse('2026-06-15T12:00:00Z') : 0,
    isLoading: overrides.isLoading ?? false,
    isFetching: overrides.isFetching ?? false,
    isError: overrides.isError ?? false,
    refetch: vi.fn(),
  });
}

describe('OpsBookingsPrintView', () => {
  beforeEach(() => {
    navigation.search = `date=${PINNED_DATE_KEY}`;
    useOpsActiveMembershipMock.mockReturnValue({
      restaurantId: 'restaurant-1',
      restaurantName: 'Old Crown',
    });
    window.print = vi.fn();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('@contract renders the no-access state without a restaurant membership', () => {
    useOpsActiveMembershipMock.mockReturnValue(null);
    mockSummaryQuery({});

    render(<OpsBookingsPrintView params={{}} />);

    expect(screen.getByText('No restaurant access')).toBeInTheDocument();
  });

  it('@contract shows a loading page and disables printing while the summary loads', () => {
    mockSummaryQuery({ isLoading: true, isFetching: true });

    render(<OpsBookingsPrintView params={{ date: PINNED_DATE_KEY }} />);

    expect(screen.getByText('Preparing pages…')).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: 'Print sheet' })) {
      expect(button).toBeDisabled();
    }
  });

  it('@contract offers a retry when the summary cannot load', () => {
    mockSummaryQuery({ isError: true });

    render(<OpsBookingsPrintView params={{}} />);

    expect(screen.getByText('Couldn’t load bookings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('@contract renders the sheet header, criteria and one row per booking without auto-printing', () => {
    mockSummaryQuery({
      summary: makeSummary({
        bookings: [
          makeBooking({
            id: 'b1',
            customerName: 'Priya Patel',
            partySize: 2,
            allergies: ['Peanuts'],
          }),
          makeBooking({ id: 'b2', customerName: 'Alex Example', partySize: 4, startTime: '19:00' }),
        ],
      }),
    });

    render(<OpsBookingsPrintView params={{ date: PINNED_DATE_KEY }} />);

    expect(screen.getByRole('heading', { name: 'Bookings run sheet' })).toBeInTheDocument();
    const printRoot = document.getElementById('ops-print-root')!;
    const page = within(printRoot).getAllByRole('article')[0]!;
    expect(within(page).getByText('Old Crown')).toBeInTheDocument();
    expect(within(page).getByText(/Sorted by time, earliest first/)).toBeInTheDocument();
    expect(within(printRoot).getByText('Priya Patel')).toBeInTheDocument();
    expect(within(printRoot).getByText('Alex Example')).toBeInTheDocument();
    expect(within(printRoot).getByText('Allergy:')).toBeInTheDocument();
    expect(window.print).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: /^Print \d+ pages?$/ })[0]!);
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it('@contract explains an empty day and an over-filtered sheet', () => {
    mockSummaryQuery({ summary: makeSummary({ bookings: [] }) });
    const { unmount } = render(<OpsBookingsPrintView params={{}} />);
    expect(screen.getByRole('heading', { name: /^No bookings on / })).toBeInTheDocument();
    unmount();

    navigation.search = `date=${PINNED_DATE_KEY}&search=zebra`;
    mockSummaryQuery({ summary: makeSummary({ bookings: [makeBooking({ id: 'b1' })] }) });
    render(<OpsBookingsPrintView params={{ search: 'zebra' }} />);
    expect(
      screen.getByRole('heading', { name: 'No bookings match these filters' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all bookings' })).toBeInTheDocument();
  });

  it('@contract keeps the guest phone number off the sheet until it is switched on', () => {
    mockSummaryQuery({
      summary: makeSummary({
        bookings: [makeBooking({ id: 'b1', customerPhone: '07700 900123' })],
      }),
    });

    render(<OpsBookingsPrintView params={{}} />);
    const printRoot = document.getElementById('ops-print-root')!;
    expect(within(printRoot).queryByText('07700 900123')).toBeNull();

    const options = screen.getByRole('complementary', { name: 'Sheet options' });
    fireEvent.click(within(options).getByRole('checkbox', { name: /Guest phone number/ }));
    expect(within(printRoot).getByText('07700 900123')).toBeInTheDocument();
  });
});
