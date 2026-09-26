/**
 * Counts the network calls one ops booking action costs, including the realtime echo of the
 * write. Every BookingService method is a counted fake; the realtime client is a fake whose
 * channels the test drives with the payloads Supabase would send for the write.
 *
 * Baseline on main @ 59d949af5 (same scenarios run against the old hooks):
 *   dashboard check-in       POST + 1 GET  (summary refetch from the realtime echo)
 *   dashboard quick assign   POST + 1 GET  (summary refetch from the realtime echo)
 *   dialog check-in          POST + 3 GETs (explicit bundle refetch, bundle echo, summary echo)
 *   dialog assign            POST + 5 GETs (context refetch, summary x2, bundle x2)
 *   bookings page check-in   POST + 3 GETs (list refetches from the echo; tab counts stale)
 */
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';



const restaurantId = '11111111-1111-4111-8111-111111111111';
const bookingId = '22222222-2222-4222-8222-222222222222';
const targetDate = '2026-07-11';

const calls = vi.hoisted(() => ({ list: [] as string[] }));
const realtime = vi.hoisted(() => ({ client: null as unknown }));
const harness = vi.hoisted(() => ({
  props: null as BookingDialogProps | null,
  assignment: null as UseTableAssignmentReturn | null,
}));
const bookingService = vi.hoisted(() => ({}) as Record<string, unknown>);

vi.mock('@/contexts/ops-services', () => ({ useBookingService: () => bookingService }));
vi.mock('@/hooks/useSupabaseSession', () => ({
  useSupabaseSession: () => ({ user: null, session: null, status: 'authenticated' }),
}));
vi.mock('@/lib/supabase/realtime-client', () => ({
  getRealtimeSupabaseClient: () => realtime.client,
}));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

// The real dialog controller and table panel hook, without the dialog's UI tree.
vi.mock('@/components/features/dashboard/BookingDetailsDialog', async () => {
  const { useTableAssignment } =
    await import('@/components/features/dashboard/booking-details/hooks/useTableAssignment');
  const { useBookingDialogController } =
    await import('@/components/features/dashboard/booking-details/hooks/useBookingDialogController');
  function Stub(props: BookingDialogProps) {
    const controller = useBookingDialogController(props);
    const assignment = useTableAssignment({
      bookingId: props.booking?.id ?? '',
      restaurantId: props.summary?.restaurantId ?? '',
      partySize: 2,
      date: props.summary?.date ?? null,
      onAssignmentComplete: controller.handleAssignmentComplete,
      enabled: props.tableAssignmentQueryEnabled ?? true,
      realtime: props.tableAssignmentRealtime ?? true,
    });
    harness.props = props;
    harness.assignment = assignment;
    return null;
  }
  return { BookingDetailsDialog: Stub };
});

import { BookingDetailsDialogWrapper } from '@/components/features/bookings/BookingDetailsDialogWrapper';
import { useOpsDashboardBookingActions } from '@/components/features/dashboard/useOpsDashboardBookingActions';
import { useBookingLifecycle } from '@src/hooks/ops/useBookingLifecycle';
import { useOpsBookingsLifecycleHandlers } from '@src/hooks/ops/useOpsBookingsLifecycleHandlers';
import { useOpsBookingsList } from '@src/hooks/ops/useOpsBookingsList';
import { useOpsBookingStatusSummary } from '@src/hooks/ops/useOpsBookingStatusSummary';
import { useOpsDashboardData } from '@src/hooks/ops/useOpsDashboardData';
import { useOpsTableAssignmentActions } from '@src/hooks/ops/useOpsTableAssignments';

import { createFakeRealtimeClient, type FakeRealtimeClient } from './__helpers__/realtime';

import type { UseTableAssignmentReturn } from '@/components/features/dashboard/booking-details/types';
import type { BookingDialogProps } from '@/components/features/dashboard/booking-details/types';
import type { OpsBookingsPage } from '@/types/ops';
import type { InfiniteData } from '@tanstack/react-query';

function counted<TArgs extends unknown[], TResult>(name: string, fn: (...args: TArgs) => TResult) {
  return vi.fn((...args: TArgs) => {
    calls.list.push(name);
    return fn(...args);
  });
}

function rt(): FakeRealtimeClient {
  return realtime.client as FakeRealtimeClient;
}

/** What Supabase realtime sends back for a status write on the booking. */
function emitStatusEcho(status: string) {
  for (const channel of rt().channels) {
    channel.emitPostgresChange('bookings', {
      new: { id: bookingId, restaurant_id: restaurantId, booking_date: targetDate, status },
      old: { id: bookingId },
    });
    channel.emitPostgresChange('booking_history', { new: { booking_id: bookingId } });
  }
}

/** What Supabase realtime sends back for a table assignment on the booking. */
function emitAssignmentEcho() {
  for (const channel of rt().channels) {
    channel.emitPostgresChange('booking_table_assignments', {
      new: { booking_id: bookingId, table_id: 't1' },
    });
    channel.emitPostgresChange('allocations', {
      new: { booking_id: bookingId, restaurant_id: restaurantId },
    });
    channel.emitPostgresChange('bookings', {
      new: {
        id: bookingId,
        restaurant_id: restaurantId,
        booking_date: targetDate,
        status: 'confirmed',
      },
    });
  }
}

/** Longer than every realtime debounce (150–750 ms). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 1000));

const summaryBooking = {
  id: bookingId,
  status: 'confirmed',
  partySize: 2,
  customerName: 'Guest',
  customerId: 'c1',
  startTime: '18:00',
  endTime: '20:00',
  checkedInAt: null,
  checkedOutAt: null,
  tableAssignments: [],
  requiresTableAssignment: true,
};

const table = {
  id: 't1',
  tableNumber: 'T1',
  capacity: 4,
  minPartySize: 1,
  maxPartySize: 4,
  section: null,
  category: 'dining',
  seatingType: 'standard',
  mobility: 'movable',
  zoneId: 'z1',
  status: 'available',
  active: true,
  position: null,
};

beforeEach(() => {
  calls.list = [];
  harness.props = null;
  harness.assignment = null;
  realtime.client = createFakeRealtimeClient();
  Object.assign(bookingService, {
    getTodaySummary: counted('GET summary', async () => ({
      restaurantId,
      date: targetDate,
      timezone: 'UTC',
      bookings: [summaryBooking],
      totals: { total: 1 },
    })),
    getDialogBundle: counted('GET dialog', async () => ({
      booking: {
        id: bookingId,
        restaurantId,
        restaurantName: 'R',
        restaurantSlug: 'r',
        restaurantTimezone: 'UTC',
        partySize: 2,
        startIso: `${targetDate}T18:00:00.000Z`,
        endIso: `${targetDate}T20:00:00.000Z`,
        status: 'confirmed',
        customerPhone: null,
        tableAssignments: [],
      },
      assignmentContext: {
        booking: { id: bookingId, restaurant_id: restaurantId, party_size: 2, status: 'confirmed' },
        timezone: 'UTC',
        tables: [table],
        bookingAssignments: [],
        conflicts: [],
        window: { startAt: '', endAt: '' },
        serverNow: '',
      },
    })),
    getBooking: counted('GET detail', async () => ({ id: bookingId, status: 'confirmed' })),
    getAssignmentContext: counted('GET context', async () => ({
      booking: { id: bookingId },
      tables: [table],
      bookingAssignments: ['t1'],
      conflicts: [],
    })),
    listBookings: counted('GET list', async () => ({
      items: [
        {
          id: bookingId,
          restaurantId,
          status: 'confirmed',
          partySize: 2,
          startIso: '',
          endIso: '',
          customerPhone: null,
          restaurantName: 'R',
          restaurantSlug: 'r',
        },
      ],
      pageInfo: { page: 1, pageSize: 50, total: 1, hasNext: false },
    })),
    getStatusSummary: counted('GET status-summary', async () => ({ totals: { confirmed: 1 } })),
    checkInBooking: counted('POST check-in', async () => ({
      status: 'checked_in',
      checkedInAt: `${targetDate}T18:01:00.000Z`,
      checkedOutAt: null,
    })),
    assignTablesDirect: counted('POST assign-tables', async () => ({
      success: true,
      assignments: [
        { id: 'a1', booking_id: bookingId, table_id: 't1', assigned_at: '', assigned_by: null },
      ],
      booking: { id: bookingId, status: 'confirmed', party_size: 2 },
      summary: { tableCount: 1, totalCapacity: 4, partySize: 2, slack: 2 },
    })),
    assignTable: counted('POST tables', async () => ({
      tableAssignments: [
        {
          groupId: null,
          capacitySum: 4,
          members: [{ tableId: 't1', tableNumber: 'T1', capacity: 4, section: null }],
        },
      ],
    })),
  });
});

function renderDashboard() {
  const queryClient = createTestQueryClient();
  const hook = renderHook(
    () => {
      const data = useOpsDashboardData({ restaurantId, targetDate });
      const lifecycle = useBookingLifecycle();
      const tableAssignmentActions = useOpsTableAssignmentActions({
        restaurantId,
        date: targetDate,
      });
      const actions = useOpsDashboardBookingActions({
        restaurantId,
        selectedDate: targetDate,
        lifecycle,
        tableAssignmentActions,
      });
      return { data, actions };
    },
    { wrapper: createQueryWrapper(queryClient) },
  );
  return { queryClient, ...hook };
}

describe('ops booking network waterfall', () => {
  it('@contract dashboard check-in costs one POST and no GET', async () => {
    const { result } = renderDashboard();
    await waitFor(() => expect(result.current.data.isSuccess).toBe(true));
    await act(settle);
    calls.list = [];

    await act(async () => {
      await result.current.actions.handleCheckIn(bookingId);
    });
    emitStatusEcho('checked_in');
    await act(settle);

    expect(calls.list).toEqual(['POST check-in']);
    expect(result.current.data.data?.bookings[0].status).toBe('checked_in');
  });

  it('@contract dashboard quick assign costs one POST and no GET', async () => {
    const { result } = renderDashboard();
    await waitFor(() => expect(result.current.data.isSuccess).toBe(true));
    await act(settle);
    calls.list = [];

    await act(async () => {
      await result.current.actions.handleAssignTable(bookingId, 't1', 'T1');
    });
    emitAssignmentEcho();
    await act(settle);

    expect(calls.list).toEqual(['POST tables']);
    expect(result.current.data.data?.bookings[0].tableAssignments[0].members[0].tableId).toBe('t1');
    // The idempotency key travels with the request, created by the intent, not the transport.
    expect(bookingService.assignTable).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId, tableId: 't1', idempotencyKey: expect.any(String) }),
    );
  });

  async function renderDialog() {
    const queryClient = createTestQueryClient();
    const Wrapper = createQueryWrapper(queryClient);
    function Page() {
      // The dashboard stays mounted (and subscribed) behind the dialog.
      useOpsDashboardData({ restaurantId, targetDate });
      return (
        <BookingDetailsDialogWrapper
          bookingId={bookingId}
          initialData={null}
          open
          onOpenChange={() => {}}
        />
      );
    }
    render(
      <Wrapper>
        <Page />
      </Wrapper>,
    );
    await waitFor(() => expect(calls.list).toContain('GET dialog'));
    await waitFor(() => expect(harness.props?.booking?.id).toBe(bookingId));
    await act(settle);
    calls.list = [];
    return queryClient;
  }

  it('@contract dialog check-in costs one POST and no GET', async () => {
    await renderDialog();

    await act(async () => {
      await harness.props?.onCheckIn?.();
    });
    emitStatusEcho('checked_in');
    await act(settle);

    expect(calls.list).toEqual(['POST check-in']);
    expect(harness.props?.booking?.status).toBe('checked_in');
  });

  it('@contract dialog table assignment costs one POST and one targeted revalidation', async () => {
    await renderDialog();

    act(() => harness.assignment?.setSelectedTables(['t1']));
    let outcome: unknown;
    await act(async () => {
      outcome = await harness.assignment?.apply();
    });
    emitAssignmentEcho();
    await act(settle);

    expect(outcome).toEqual({ ok: true });
    expect(calls.list).toEqual(['POST assign-tables', 'GET dialog']);
    expect(bookingService.assignTablesDirect).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId, tableIds: ['t1'], idempotencyKey: expect.any(String) }),
    );
  });

  it('@contract bookings page check-in costs one POST plus the tab-count refresh, and drops the row from a filter it left', async () => {
    const queryClient = createTestQueryClient();
    const filters = { restaurantId, statuses: ['confirmed' as const, 'pending' as const] };
    const { result } = renderHook(
      () => {
        const list = useOpsBookingsList(filters);
        useOpsBookingStatusSummary({
          restaurantId,
          from: `${targetDate}T00:00:00.000Z`,
          to: `${targetDate}T23:59:59.000Z`,
        });
        const lifecycle = useOpsBookingsLifecycleHandlers({
          restaurantId,
          targetDate,
          getBookingLabel: () => 'Guest',
        });
        return { list, lifecycle };
      },
      { wrapper: createQueryWrapper(queryClient) },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    await act(settle);
    calls.list = [];

    await act(async () => {
      await result.current.lifecycle.onCheckIn(bookingId);
    });
    emitStatusEcho('checked_in');
    await act(settle);

    expect(calls.list).toEqual(['POST check-in', 'GET status-summary']);
    const data = result.current.list.data as InfiniteData<OpsBookingsPage> | undefined;
    expect(data?.pages[0].items).toEqual([]);
    expect(data?.pages[0].pageInfo.total).toBe(0);
  });

  it('@contract another client’s change to the booking still refreshes the dashboard', async () => {
    const { result } = renderDashboard();
    await waitFor(() => expect(result.current.data.isSuccess).toBe(true));
    await act(settle);
    calls.list = [];

    emitStatusEcho('cancelled');
    await act(settle);

    expect(calls.list).toEqual(['GET summary']);
  });
});
