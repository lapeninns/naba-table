import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { OpsSessionProvider } from '@/contexts/ops-session';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsDashboardClient } from '@/components/features/dashboard/OpsDashboardClient';
import type { OpsFeatureFlags, OpsMembership, OpsTodayBookingsSummary } from '@/types/ops';
import type { BookingService } from '@/services/ops/bookings';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpError } from '@/lib/http/errors';

const getSelectorMetricsMock = vi.fn();

vi.mock('@/services/ops/selectorMetrics', () => ({
  getSelectorMetrics: (...args: Parameters<typeof getSelectorMetricsMock>) => getSelectorMetricsMock(...args),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/ops',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/hooks')>('@/hooks');

  const createMutationStub = () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    variables: null,
  });

  return {
    ...actual,
    useOpsCapacityUtilization: () => ({ data: { periods: [] }, isLoading: false }),
    useOpsBookingHeatmap: () => ({ data: {}, isLoading: false }),
    useOpsTodayVIPs: () => ({
      data: { date: '2025-05-01', vips: [], totalVipCovers: 0 },
      isLoading: false,
    }),
    useOpsBookingChanges: () => ({ data: { changes: [] }, isLoading: false }),
    useOpsBookingLifecycleActions: () => ({
      checkIn: createMutationStub(),
      checkOut: createMutationStub(),
      markNoShow: createMutationStub(),
      undoNoShow: createMutationStub(),
    }),
    useOpsTableAssignmentActions: () => ({
      assignTable: createMutationStub(),
      unassignTable: createMutationStub(),
      autoAssignTables: { mutate: vi.fn(), isPending: false },
    }),
  };
});

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const defaultMemberships: OpsMembership[] = [
  {
    restaurantId: 'rest-1',
    restaurantName: 'Main Restaurant',
    restaurantSlug: 'main-restaurant',
    role: 'owner',
    createdAt: null,
  },
];

const defaultSummary: OpsTodayBookingsSummary = {
  date: '2025-05-01',
  timezone: 'UTC',
  restaurantId: 'rest-1',
  totals: {
    total: 0,
    confirmed: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
    noShow: 0,
    upcoming: 0,
    covers: 0,
  },
  bookings: [],
};

const defaultFeatureFlags: OpsFeatureFlags = {
  capacityConfig: false,
  opsMetrics: true,
  selectorScoring: true,
};

function createBookingService(summary: OpsTodayBookingsSummary): BookingService {
  return {
    getTodaySummary: vi.fn().mockResolvedValue(summary),
    getBookingHeatmap: vi.fn(),
    listBookings: vi.fn(),
    updateBooking: vi.fn(),
    updateBookingStatus: vi.fn(),
    cancelBooking: vi.fn(),
    createWalkInBooking: vi.fn(),
    assignTable: vi.fn(),
    unassignTable: vi.fn(),
    autoAssignTables: vi.fn().mockResolvedValue({ assigned: [], skipped: [] }),
  } as unknown as BookingService;
}

function renderDashboard({
  summary = defaultSummary,
  featureFlags = defaultFeatureFlags,
}: {
  summary?: OpsTodayBookingsSummary;
  featureFlags?: OpsFeatureFlags;
}) {
  const queryClient = createQueryClient();
  const bookingService = createBookingService(summary);

  render(
    <QueryClientProvider client={queryClient}>
      <OpsSessionProvider
        user={{ id: 'user-1', email: 'ops@example.com' }}
        memberships={defaultMemberships}
        initialRestaurantId={defaultMemberships[0]?.restaurantId ?? null}
        featureFlags={featureFlags}
      >
        <OpsServicesProvider factories={{ bookingService: () => bookingService }}>
          <TooltipProvider>
            <OpsDashboardClient initialDate={null} />
          </TooltipProvider>
        </OpsServicesProvider>
      </OpsSessionProvider>
    </QueryClientProvider>,
  );
}

describe('OpsDashboardClient selector metrics', () => {
  beforeEach(() => {
    getSelectorMetricsMock.mockReset();
  });

  it('renders selector metrics summary, skips, and samples when feature enabled', async () => {
    getSelectorMetricsMock.mockResolvedValue({
      summary: {
        assignmentsTotal: 12,
        skippedTotal: 3,
        mergeRate: 0.25,
        avgOverage: 1.5,
        avgDurationMs: 85,
        p95DurationMs: 180,
      },
      skipReasons: [
        { reason: 'Capacity limit', count: 2 },
        { reason: 'Table already assigned', count: 1 },
      ],
      samples: [
        {
          createdAt: '2025-05-01T18:00:00Z',
          bookingId: 'booking-1',
          selected: { tableNumbers: ['T1'], tableIds: ['table-1'], slack: 1, tableCount: 1 },
          skipReason: null,
          topCandidates: [],
          durationMs: 90,
        },
        {
          createdAt: '2025-05-01T18:05:00Z',
          bookingId: 'booking-2',
          selected: null,
          skipReason: 'No adjacency match',
          topCandidates: [],
          durationMs: 70,
        },
      ],
    });

    renderDashboard({});

    await waitFor(() => expect(screen.getByRole('heading', { name: /assignment insights/i })).toBeVisible());

    expect(screen.getByText('Assignments')).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();
    expect(screen.getByText('Capacity limit')).toBeVisible();
    expect(screen.getByText(/Skipped: No adjacency match/i)).toBeVisible();
  });

  it('renders empty states when no metrics are available', async () => {
    getSelectorMetricsMock.mockResolvedValue({
      summary: {
        assignmentsTotal: 0,
        skippedTotal: 0,
        mergeRate: 0,
        avgOverage: 0,
        avgDurationMs: 0,
        p95DurationMs: null,
      },
      skipReasons: [],
      samples: [],
    });

    renderDashboard({});

    await waitFor(() => expect(screen.getByRole('heading', { name: /assignment insights/i })).toBeVisible());

    expect(screen.getByText(/No skips recorded/i)).toBeVisible();
    expect(screen.getByText(/No telemetry events available yet/i)).toBeVisible();
  });

  it('surfaces error alert when metrics request fails', async () => {
    getSelectorMetricsMock.mockRejectedValue(
      new HttpError({ status: 500, message: 'Server exploded' }),
    );

    renderDashboard({});

    await waitFor(() => expect(screen.getByText(/Metrics unavailable/i)).toBeVisible());
    expect(screen.getByText(/Server exploded/i)).toBeVisible();
  });

  it('skips metrics query entirely when feature flag disabled', async () => {
    getSelectorMetricsMock.mockResolvedValue({});

    renderDashboard({ featureFlags: { ...defaultFeatureFlags, opsMetrics: false } });

    await waitFor(() => expect(screen.getByRole('heading', { name: /reservations/i })).toBeVisible());
    expect(screen.queryByRole('heading', { name: /assignment insights/i })).toBeNull();
    expect(getSelectorMetricsMock).not.toHaveBeenCalled();
  });
});
