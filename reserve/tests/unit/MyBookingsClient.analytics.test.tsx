import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MyBookingsClient } from '@/app/(guest-account)/my-bookings/MyBookingsClient';
import * as bookingsTableModule from '@/components/dashboard/BookingsTable';
import * as useBookingsModule from '@/hooks/useBookings';
import * as tableStateModule from '@/hooks/useBookingsTableState';
import * as cancelBookingModule from '@/hooks/useCancelBooking';
import * as analyticsModule from '@/lib/analytics';

import type { BookingsTableProps } from '@/components/dashboard/BookingsTable';
import type { BookingDTO } from '@/hooks/useBookings';

vi.mock('@/components/dashboard/CancelBookingDialog', () => ({
  CancelBookingDialog: (): React.ReactElement | null => null,
}));

vi.mock('@/components/dashboard/EditBookingDialog', () => ({
  EditBookingDialog: (): React.ReactElement | null => null,
}));

const booking: BookingDTO = {
  id: 'booking-abc',
  restaurantName: 'Test Bistro',
  partySize: 2,
  startIso: '2050-01-01T18:00:00.000Z',
  endIso: '2050-01-01T20:00:00.000Z',
  status: 'confirmed',
  notes: null,
};

const bookingsTableSpy = vi.spyOn(bookingsTableModule, 'BookingsTable');
const useBookingsSpy = vi.spyOn(useBookingsModule, 'useBookings');
const useBookingsTableStateSpy = vi.spyOn(tableStateModule, 'useBookingsTableState');
const useCancelBookingSpy = vi.spyOn(cancelBookingModule, 'useCancelBooking');
const trackSpy = vi.spyOn(analyticsModule, 'track');

let capturedProps: BookingsTableProps | null = null;

beforeEach(() => {
  capturedProps = null;
  bookingsTableSpy.mockImplementation((props: BookingsTableProps) => {
    capturedProps = props;
    return (
      <table data-testid="my-bookings-table">
        <tbody>
          {props.bookings.map((item) => (
            <tr key={item.id}>
              <td>{item.restaurantName}</td>
              <td>
                <button type="button" onClick={() => props.onCancel(item)}>
                  Cancel
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  });

  useBookingsTableStateSpy.mockReturnValue({
    statusFilter: 'upcoming',
    page: 1,
    pageSize: 10,
    queryFilters: { page: 1, pageSize: 10, sort: 'asc' },
    setPage: vi.fn(),
    setStatusFilter: vi.fn(),
    handleStatusFilterChange: vi.fn(),
    handlePageChange: vi.fn(),
  } as unknown as ReturnType<typeof tableStateModule.useBookingsTableState>);

  useBookingsSpy.mockReturnValue({
    data: {
      items: [booking],
      pageInfo: { page: 1, pageSize: 10, total: 1, hasNext: false },
    },
    error: null,
    status: 'success',
    isPending: false,
    isSuccess: true,
    isError: false,
    isLoading: false,
    isFetching: false,
    fetchStatus: 'idle',
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useBookingsModule.useBookings>);

  useCancelBookingSpy.mockReturnValue({
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    status: 'success',
    isPending: false,
    isError: false,
    isIdle: false,
    isSuccess: true,
    reset: vi.fn(),
    data: { id: booking.id, status: 'cancelled' },
    error: null,
  } as unknown as ReturnType<typeof cancelBookingModule.useCancelBooking>);

  trackSpy.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MyBookingsClient analytics', () => {
  it('tracks cancel dialog open event when cancel action is invoked', async () => {
    render(<MyBookingsClient />);

    expect(capturedProps).not.toBeNull();
    expect(trackSpy).toHaveBeenCalledWith('dashboard_viewed', {
      totalBookings: 1,
      filter: 'upcoming',
    });

    await act(async () => {
      await screen.getByText('Cancel').click();
    });

    expect(trackSpy).toHaveBeenCalledWith('dashboard_cancel_opened', {
      bookingId: booking.id,
      status: booking.status,
    });
  });
});
