import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ReservationDetailDialogs lazy-loads both dashboard dialogs through next/dynamic;
// replace the loader with a prop-echoing stub so open/venue wiring is observable.
// EditBookingDialog receives restaurantSlug/restaurantTimezone, CancelBookingDialog
// does not — that difference distinguishes the two mocked instances.
vi.mock('next/dynamic', () => ({
  default: () => {
    return function MockDynamicDialog(props: {
      open?: boolean;
      restaurantSlug?: string | null;
      restaurantTimezone?: string | null;
      booking?: { id?: string };
    }) {
      const kind = 'restaurantSlug' in props ? 'edit' : 'cancel';
      return (
        <div
          data-testid={`dialog-${kind}`}
          data-open={String(props.open ?? false)}
          data-slug={props.restaurantSlug ?? ''}
          data-timezone={props.restaurantTimezone ?? ''}
          data-booking-id={props.booking?.id ?? ''}
        />
      );
    };
  },
}));

import { ReservationDetailDialogs } from '@/components/features/booking/detail/ReservationDetailDialogs';

import type { ReservationVenue } from '@/components/features/booking/detail/reservationDetailDomain';
import type { BookingDTO } from '@/hooks/useBookings';

const venue: ReservationVenue = {
  name: 'The Fox',
  address: '1 High Street',
  timezone: 'Europe/London',
  slug: 'the-fox',
};

function makeBookingDto(overrides: Partial<BookingDTO> = {}): BookingDTO {
  return {
    id: 'booking-1',
    restaurantName: 'The Fox',
    restaurantSlug: 'dto-slug',
    restaurantTimezone: 'Europe/Paris',
    partySize: 2,
    startIso: '2026-07-01T17:30:00.000Z',
    endIso: '2026-07-01T19:00:00.000Z',
    status: 'confirmed',
    ...overrides,
  } as BookingDTO;
}

type DialogProps = Parameters<typeof ReservationDetailDialogs>[0];

function makeProps(overrides: Partial<DialogProps> = {}): DialogProps {
  return {
    bookingDto: makeBookingDto(),
    closeCancelDialog: vi.fn(),
    closeEditDialog: vi.fn(),
    isCancelOpen: false,
    isEditOpen: false,
    venue,
    ...overrides,
  };
}

describe('ReservationDetailDialogs', () => {
  it('@contract renders nothing without a booking DTO', () => {
    const { container } = render(
      <ReservationDetailDialogs {...makeProps({ bookingDto: null })} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract passes the open flags through to the edit and cancel dialogs', () => {
    const { rerender } = render(<ReservationDetailDialogs {...makeProps()} />);

    expect(screen.getByTestId('dialog-edit')).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId('dialog-cancel')).toHaveAttribute('data-open', 'false');

    rerender(<ReservationDetailDialogs {...makeProps({ isEditOpen: true })} />);
    expect(screen.getByTestId('dialog-edit')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('dialog-cancel')).toHaveAttribute('data-open', 'false');

    rerender(<ReservationDetailDialogs {...makeProps({ isCancelOpen: true })} />);
    expect(screen.getByTestId('dialog-edit')).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId('dialog-cancel')).toHaveAttribute('data-open', 'true');
  });

  it('@contract prefers venue slug and timezone over the booking DTO values', () => {
    render(<ReservationDetailDialogs {...makeProps()} />);

    const editDialog = screen.getByTestId('dialog-edit');
    expect(editDialog).toHaveAttribute('data-slug', 'the-fox');
    expect(editDialog).toHaveAttribute('data-timezone', 'Europe/London');
    expect(editDialog).toHaveAttribute('data-booking-id', 'booking-1');
  });

  it('@contract falls back to booking DTO slug and timezone when the venue lacks them', () => {
    render(
      <ReservationDetailDialogs
        {...makeProps({ venue: { ...venue, slug: null, timezone: undefined as never } })}
      />,
    );

    const editDialog = screen.getByTestId('dialog-edit');
    expect(editDialog).toHaveAttribute('data-slug', 'dto-slug');
    expect(editDialog).toHaveAttribute('data-timezone', 'Europe/Paris');
  });
});
