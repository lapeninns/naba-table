import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useTableAssignment } from '@/components/features/dashboard/booking-details/hooks/useTableAssignment';

import type { AssignmentContext, ManualAssignmentTable } from '@/services/ops/bookings';

const mockGetAssignmentContext = vi.fn();
const mockAssignTablesDirect = vi.fn();
const mockUnassignTablesDirect = vi.fn();

vi.mock('@/contexts/ops-services', () => ({
  useBookingService: () => ({
    getAssignmentContext: mockGetAssignmentContext,
    assignTablesDirect: mockAssignTablesDirect,
    unassignTablesDirect: mockUnassignTablesDirect,
  }),
}));

const baseTable: ManualAssignmentTable = {
  id: 't-1',
  tableNumber: '10',
  capacity: 4,
  minPartySize: 1,
  maxPartySize: 4,
  section: 'Main',
  category: 'dining',
  seatingType: 'indoor',
  mobility: 'standard',
  zoneId: 'zone-1',
  zoneActive: true,
  status: 'available',
  active: true,
  position: null,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useTableAssignment validation', () => {
  it('flags conflicts and capacity shortfalls', async () => {
    const context: AssignmentContext = {
      booking: {
        id: 'b-1',
        restaurant_id: 'r-1',
        start_at: null,
        booking_date: '2025-12-28',
        start_time: '18:00',
        party_size: 5,
        status: 'confirmed',
      },
      tables: [
        { ...baseTable, id: 't-1', capacity: 2 },
        { ...baseTable, id: 't-2', capacity: 3 },
      ],
      bookingAssignments: [],
      conflicts: [
        {
          tableId: 't-1',
          bookingId: 'b-2',
          startAt: '2025-12-28T18:00:00Z',
          endAt: '2025-12-28T19:30:00Z',
          status: 'confirmed',
        },
      ],
      window: { startAt: '2025-12-28T17:00:00Z', endAt: '2025-12-28T21:00:00Z' },
      serverNow: '2025-12-28T17:30:00Z',
    };

    mockGetAssignmentContext.mockResolvedValueOnce(context);

    const { result } = renderHook(
      () =>
        useTableAssignment({
          bookingId: 'b-1',
          restaurantId: 'r-1',
          partySize: 5,
          currentAssignments: [],
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setSelectedTables(['t-1']);
    });

    expect(result.current.validation.errors.length).toBeGreaterThan(0);

    act(() => {
      result.current.setSelectedTables(['t-2']);
    });

    expect(result.current.validation.errors.length).toBeGreaterThan(0); // capacity shortfall

    act(() => {
      result.current.setSelectedTables(['t-2', 't-1']);
    });

    expect(result.current.validation.warnings.length).toBeGreaterThan(0);
  });
});
