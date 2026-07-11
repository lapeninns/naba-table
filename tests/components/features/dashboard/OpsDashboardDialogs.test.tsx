import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { cancelDialogSpy, editDialogSpy, detailsWrapperSpy } = vi.hoisted(() => ({
  cancelDialogSpy: vi.fn(() => <div data-testid="cancel-dialog" />),
  editDialogSpy: vi.fn(() => <div data-testid="edit-dialog" />),
  detailsWrapperSpy: vi.fn(() => <div data-testid="details-wrapper" />),
}));

vi.mock('@/components/features/bookings/components/OpsCancelBookingAlertDialog', () => ({
  OpsCancelBookingAlertDialog: cancelDialogSpy,
}));
vi.mock('@/components/dashboard/EditBookingDialog', () => ({
  EditBookingDialog: editDialogSpy,
}));
vi.mock('@/components/features/bookings/BookingDetailsDialogWrapper', () => ({
  BookingDetailsDialogWrapper: detailsWrapperSpy,
}));

import { OpsDashboardDialogs } from '@/components/features/dashboard/OpsDashboardDialogs';

import type { OpsDashboardDialogsProps } from '@/components/features/dashboard/OpsDashboardDialogs';
import type { BookingDTO } from '@/hooks/useBookings';

const booking = {
  id: 'booking-9',
  customerName: 'Alex Example',
  partySize: 4,
} as unknown as BookingDTO;

function makeProps(overrides: Partial<OpsDashboardDialogsProps> = {}): OpsDashboardDialogsProps {
  return {
    detailsBooking: null,
    isDetailsOpen: false,
    onDetailsOpenChange: vi.fn(),
    editBooking: null,
    isEditOpen: false,
    onEditOpenChange: vi.fn(),
    restaurantSlug: 'old-crown',
    restaurantTimezone: 'Europe/London',
    cancelBooking: null,
    isCancelOpen: false,
    onCancelOpenChange: vi.fn(),
    onConfirmCancel: vi.fn(),
    isCancelPending: false,
    ...overrides,
  };
}

describe('OpsDashboardDialogs', () => {
  it('@contract mounts the details wrapper only while the details dialog is open', async () => {
    const { rerender } = render(<OpsDashboardDialogs {...makeProps()} />);
    expect(screen.queryByTestId('details-wrapper')).not.toBeInTheDocument();

    rerender(
      <OpsDashboardDialogs
        {...makeProps({ detailsBooking: booking, isDetailsOpen: true })}
      />,
    );

    expect(await screen.findByTestId('details-wrapper')).toBeInTheDocument();
    const forwarded = detailsWrapperSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(forwarded.bookingId).toBe('booking-9');
    expect(forwarded.initialData).toBe(booking);
    expect(forwarded.open).toBe(true);
  });

  it('@contract forwards edit state, slug, and timezone to the edit dialog in ops mode', async () => {
    render(
      <OpsDashboardDialogs {...makeProps({ editBooking: booking, isEditOpen: true })} />,
    );

    expect(await screen.findByTestId('edit-dialog')).toBeInTheDocument();
    const forwarded = editDialogSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(forwarded.booking).toBe(booking);
    expect(forwarded.open).toBe(true);
    expect(forwarded.restaurantSlug).toBe('old-crown');
    expect(forwarded.restaurantTimezone).toBe('Europe/London');
    expect(forwarded.mode).toBe('ops');
  });

  it('@contract wires the cancel dialog with guest details and the confirm handler', async () => {
    const props = makeProps({
      cancelBooking: booking,
      isCancelOpen: true,
      isCancelPending: true,
    });
    render(<OpsDashboardDialogs {...props} />);

    expect(await screen.findByTestId('cancel-dialog')).toBeInTheDocument();
    const forwarded = cancelDialogSpy.mock.calls.at(-1)?.[0] as {
      customerName: string | null;
      partySize: number | null;
      isPending: boolean;
      onConfirm: () => void;
    };
    expect(forwarded.customerName).toBe('Alex Example');
    expect(forwarded.partySize).toBe(4);
    expect(forwarded.isPending).toBe(true);

    forwarded.onConfirm();
    expect(props.onConfirmCancel).toHaveBeenCalledTimes(1);
  });

  it('@contract passes null guest fields when no cancel target is set', async () => {
    render(<OpsDashboardDialogs {...makeProps({ isCancelOpen: true })} />);

    expect(await screen.findByTestId('cancel-dialog')).toBeInTheDocument();
    const forwarded = cancelDialogSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(forwarded.customerName).toBeNull();
    expect(forwarded.partySize).toBeNull();
  });
});
