import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useOpsTableAssignmentActions } from '@/hooks/ops/useOpsTableAssignments';
import { queryKeys } from '@/lib/query/keys';

import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';

const mockAssignTable = vi.fn();
const mockUnassignTable = vi.fn();

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => ({
    assignTable: mockAssignTable,
    unassignTable: mockUnassignTable,
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

const booking: OpsTodayBooking = {
  id: 'b-1',
  status: 'confirmed',
  startTime: '18:00',
  endTime: '19:00',
  partySize: 2,
  customerName: 'Jamie Lee',
  customerEmail: null,
  customerPhone: null,
  notes: null,
  reference: null,
  details: null,
  source: null,
  loyaltyTier: null,
  loyaltyPoints: null,
  profileNotes: null,
  allergies: null,
  dietaryRestrictions: null,
  seatingPreference: null,
  marketingOptIn: null,
  tableAssignments: [
    {
      groupId: 'g-1',
      capacitySum: 2,
      members: [
        {
          tableId: 't-1',
          tableNumber: '10',
          capacity: 2,
          section: 'Main',
        },
      ],
    },
  ],
  requiresTableAssignment: false,
  checkedInAt: null,
  checkedOutAt: null,
};

const summary: OpsTodayBookingsSummary = {
  date: '2026-01-19',
  timezone: 'UTC',
  restaurantId: 'r-1',
  totals: {
    total: 1,
    confirmed: 1,
    completed: 0,
    pending: 0,
    cancelled: 0,
    noShow: 0,
    upcoming: 0,
    covers: 2,
  },
  bookings: [booking],
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useOpsTableAssignmentActions', () => {
  it('updates summary totals when unassigning the last table changes status', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const summaryKey = queryKeys.opsDashboard.summary('r-1', null);

    queryClient.setQueryData(summaryKey, summary);

    mockUnassignTable.mockResolvedValueOnce({ tableAssignments: [] });

    const { result } = renderHook(
      () => useOpsTableAssignmentActions({ restaurantId: 'r-1', date: null }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.unassignTable.mutateAsync({ bookingId: 'b-1', tableId: 't-1' });
    });

    const updated = queryClient.getQueryData<OpsTodayBookingsSummary>(summaryKey);

    expect(mockUnassignTable).toHaveBeenCalledWith({ bookingId: 'b-1', tableId: 't-1' });
    expect(updated?.bookings[0].status).toBe('pending');
    expect(updated?.totals.confirmed).toBe(0);
    expect(updated?.totals.pending).toBe(1);
  });
});
