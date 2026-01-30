import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { OpsBookingsClient } from '@/components/features/bookings/OpsBookingsClient';

const booking = {
  id: 'b-1',
  restaurantId: 'r-1',
  restaurantName: 'Test Restaurant',
  restaurantSlug: 'test-restaurant',
  restaurantTimezone: 'UTC',
  partySize: 2,
  startIso: '2026-01-28T18:00:00.000Z',
  endIso: '2026-01-28T19:30:00.000Z',
  status: 'confirmed',
  notes: null,
  customerName: 'Alex',
  customerEmail: null,
  customerPhone: null,
  reservationIntervalMinutes: 90,
  reference: 'REF-1',
  source: 'phone',
  loyaltyTier: null,
  loyaltyPoints: null,
  seatingPreference: null,
  allergies: null,
  dietaryRestrictions: null,
  tableAssignments: [],
  requiresTableAssignment: false,
  checkedInAt: null,
  checkedOutAt: null,
};

vi.mock('next/dynamic', () => ({
  default: () => {
    return ({ open }: { open: boolean }) =>
      open ? <div data-testid="edit-dialog">Edit dialog</div> : null;
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/app/bookings',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/dashboard/BookingsTable', () => ({
  BookingsTable: ({ onEdit, onDetails }: { onEdit?: (value: typeof booking) => void; onDetails?: (value: typeof booking) => void }) => (
    <div>
      <button type="button" onClick={() => onEdit?.(booking)}>
        Trigger Edit
      </button>
      <button type="button" onClick={() => onDetails?.(booking)}>
        Trigger Details
      </button>
    </div>
  ),
}));

vi.mock('@/components/features/bookings/BookingDetailsDialogWrapper', () => ({
  BookingDetailsDialogWrapper: ({ open }: { open: boolean }) =>
    open ? <div data-testid="details-dialog">Details dialog</div> : null,
}));

vi.mock('@/components/features/booking-state-machine', () => ({
  BookingOfflineBanner: () => null,
}));

vi.mock('@/contexts/booking-state-machine', () => ({
  BookingStateMachineProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useBookingStateMachine: () => ({ registerBookings: vi.fn() }),
}));

vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => ({
    memberships: [
      {
        restaurantId: 'r-1',
        restaurantName: 'Test Restaurant',
        restaurantSlug: 'test-restaurant',
        role: 'owner',
        createdAt: null,
      },
    ],
    activeRestaurantId: 'r-1',
    setActiveRestaurantId: vi.fn(),
    accountSnapshot: { restaurantName: 'Test Restaurant', userEmail: 'test@example.com', role: 'owner' },
  }),
  useOpsActiveMembership: () => ({
    restaurantId: 'r-1',
    restaurantName: 'Test Restaurant',
    restaurantSlug: 'test-restaurant',
    role: 'owner',
    createdAt: null,
  }),
}));

vi.mock('@/hooks/ops/useOpsBookingsTableState', () => ({
  useOpsBookingsTableState: () => ({
    statusFilter: 'upcoming',
    page: 1,
    pageSize: 10,
    queryFilters: { page: 1, pageSize: 10 },
    handleStatusFilterChange: vi.fn(),
    handlePageChange: vi.fn(),
    handleSearchChange: vi.fn(),
    setPage: vi.fn(),
    search: '',
    selectedStatuses: [],
    toggleSelectedStatus: vi.fn(),
    clearSelectedStatuses: vi.fn(),
  }),
}));

vi.mock('@/hooks/ops/useOpsBookingsList', () => ({
  useOpsBookingsList: () => ({
    data: {
      items: [booking],
      pageInfo: { page: 1, pageSize: 10, total: 1, hasNext: false },
    },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/ops/useOpsBookingStatusSummary', () => ({
  useOpsBookingStatusSummary: () => ({
    data: { totals: { pending: 0, pending_allocation: 0, confirmed: 1, checked_in: 0, completed: 0, cancelled: 0, no_show: 0, PRIORITY_WAITLIST: 0 } },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/ops/useOpsBookingStatusActions', () => ({
  useOpsBookingLifecycleActions: () => ({
    markNoShow: { mutateAsync: vi.fn() },
    undoNoShow: { mutateAsync: vi.fn() },
    checkIn: { mutateAsync: vi.fn() },
    checkOut: { mutateAsync: vi.fn() },
  }),
}));

vi.mock('@/hooks/ops/useOpsBooking', () => ({
  useOpsBooking: () => ({ data: null }),
}));

vi.mock('@/hooks/ops/useOpsRestaurantDetails', () => ({
  useOpsRestaurantDetails: () => ({ data: { timezone: 'UTC' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  default: () => true,
}));

const renderWithClient = () => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <OpsBookingsClient />
    </QueryClientProvider>,
  );
};

describe('OpsBookingsClient Edit/Details dialogs', () => {
  it('opens edit dialog when Edit Booking is clicked', async () => {
    renderWithClient();

    expect(screen.queryByTestId('edit-dialog')).toBeNull();
    expect(screen.queryByTestId('details-dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /trigger edit/i }));

    expect(await screen.findByTestId('edit-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('details-dialog')).toBeNull();
  });

  it('opens details dialog when Details is clicked', () => {
    renderWithClient();

    fireEvent.click(screen.getByRole('button', { name: /trigger details/i }));

    expect(screen.getByTestId('details-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-dialog')).toBeNull();
  });
});
