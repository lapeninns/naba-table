import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const useReservationMock = vi.fn();

vi.mock('@features/reservations/wizard/api/useReservation', () => ({
  useReservation: (...args: unknown[]) => useReservationMock(...args),
}));

vi.mock('@/lib/analytics/emit', () => ({
  emit: vi.fn(),
}));

vi.mock('@/lib/reservations/share', () => ({
  shareReservationDetails: vi.fn(),
}));

import { ReceiptClient } from '@/app/guest/bookings/[bookingId]/receipt/ReceiptClient';

const reservation = {
  id: 'booking-2',
  restaurantId: 'rest-1',
  restaurantName: 'The Fox',
  restaurantSlug: 'the-fox',
  restaurantTimezone: 'Europe/London',
  partySize: 4,
  startAt: '2026-05-20T18:30:00.000Z',
  endAt: '2026-05-20T20:00:00.000Z',
  status: 'confirmed',
  notes: null,
  customerName: 'Receipt Guest',
  customerEmail: 'receipt@example.com',
  customerPhone: '+441234567891',
  seatingPreference: 'Indoor',
  reference: 'NB5678',
  createdAt: '2026-04-01T10:00:00.000Z',
};

describe('ReceiptClient', () => {
  beforeEach(() => {
    useReservationMock.mockReset();
  });

  it('renders the booking receipt details for token access', () => {
    useReservationMock.mockReturnValue({
      data: reservation,
      isLoading: false,
      isError: false,
    });

    render(
      <ReceiptClient
        reservationId={reservation.id}
        hasSession={false}
        prefetchedStatus={reservation.status}
      />,
    );

    expect(screen.getByText('The Fox')).toBeInTheDocument();
    expect(screen.getByText('NB5678')).toBeInTheDocument();
    expect(screen.getByText('Save this receipt for easier check-in when you arrive.')).toBeInTheDocument();
    expect(screen.getByText('receipt@example.com')).toBeInTheDocument();
    expect(screen.getByText('Party')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Sign in to manage bookings faster.')).toBeInTheDocument();
  });

  it('shows the fallback error state when the receipt cannot be loaded', () => {
    useReservationMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
    });

    render(<ReceiptClient reservationId={reservation.id} hasSession prefetchedStatus={null} />);

    expect(screen.getByText("We couldn't load your receipt. Please try the link again.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View my bookings' })).toHaveAttribute(
      'href',
      '/guest/bookings',
    );
  });
});
