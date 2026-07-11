import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  BookingGrid,
  BookingsLoadingState,
} from '@/components/features/booking/list/BookingListCards';

import type { BookingDTO } from '@/guest/services/ports';

function makeBooking(overrides: Partial<BookingDTO> = {}): BookingDTO {
  return {
    id: 'booking-1',
    restaurantId: 'rest-1',
    restaurantName: 'White Horse',
    restaurantSlug: 'white-horse',
    restaurantTimezone: 'Europe/London',
    partySize: 2,
    // 18:30 UTC renders as 19:30 in the venue's Europe/London summer time,
    // independent of the host timezone.
    startIso: '2026-07-01T18:30:00.000Z',
    endIso: '2026-07-01T20:00:00.000Z',
    status: 'confirmed',
    notes: null,
    ...overrides,
  };
}

describe('BookingListCards', () => {
  it('@smoke renders the loading state skeletons without throwing', () => {
    const { container } = render(<BookingsLoadingState />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('@contract renders venue-local date and time labels for each booking card', () => {
    render(<BookingGrid bookings={[makeBooking()]} />);

    expect(screen.getByRole('heading', { name: 'White Horse' })).toBeInTheDocument();
    expect(screen.getByText('Jul')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('19:30')).toBeInTheDocument();
    expect(screen.getByText('2 guests')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('@contract falls back to placeholder labels when the start time cannot be parsed', () => {
    render(<BookingGrid bookings={[makeBooking({ startIso: 'not-a-date' })]} />);

    expect(screen.getByText('TBC')).toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getByText('Time pending')).toBeInTheDocument();
  });

  it('@contract links manage and receipt actions to the booking routes', () => {
    render(<BookingGrid bookings={[makeBooking()]} />);

    expect(screen.getByRole('link', { name: 'Manage booking' })).toHaveAttribute(
      'href',
      '/guest/bookings/booking-1',
    );
    expect(screen.getByRole('link', { name: 'Receipt' })).toHaveAttribute(
      'href',
      '/guest/bookings/booking-1/receipt',
    );
  });

  it('@contract swaps the primary action label for past bookings', () => {
    render(<BookingGrid bookings={[makeBooking({ status: 'completed' })]} isPast />);

    expect(screen.getByRole('link', { name: 'Open booking' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage booking' })).not.toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('@contract @a11y opens the card menu and offers cancellation for active bookings', async () => {
    const user = userEvent.setup();
    render(<BookingGrid bookings={[makeBooking()]} />);

    await user.click(screen.getByRole('button', { name: 'Open booking menu' }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'View booking' })).toHaveAttribute(
      'href',
      '/guest/bookings/booking-1',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Open receipt' })).toHaveAttribute(
      'href',
      '/guest/bookings/booking-1/receipt',
    );
    expect(within(menu).getByRole('menuitem', { name: 'View restaurant' })).toHaveAttribute(
      'href',
      '/restaurants/white-horse',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Cancel booking' })).toHaveAttribute(
      'href',
      '/guest/bookings/booking-1?intent=cancel',
    );
  });

  it('@contract hides the cancel action for cancelled and past bookings', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<BookingGrid bookings={[makeBooking({ status: 'cancelled' })]} />);

    await user.click(screen.getByRole('button', { name: 'Open booking menu' }));
    expect(screen.queryByRole('menuitem', { name: 'Cancel booking' })).not.toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    unmount();

    render(<BookingGrid bookings={[makeBooking()]} isPast />);
    await user.click(screen.getByRole('button', { name: 'Open booking menu' }));
    expect(screen.queryByRole('menuitem', { name: 'Cancel booking' })).not.toBeInTheDocument();
  });

  it('@contract falls back to the restaurants index when the booking has no slug', async () => {
    const user = userEvent.setup();
    render(<BookingGrid bookings={[makeBooking({ restaurantSlug: null })]} />);

    await user.click(screen.getByRole('button', { name: 'Open booking menu' }));
    expect(screen.getByRole('menuitem', { name: 'View restaurant' })).toHaveAttribute(
      'href',
      '/restaurants',
    );
  });
});
