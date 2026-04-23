import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const pushMock = vi.fn();
const useReservationMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    return function MockDynamicDialog(props: { open?: boolean }) {
      return props.open ? <div data-testid="reservation-dialog-open" /> : null;
    };
  },
}));

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

vi.mock('@/lib/analytics/emit', () => ({
  emit: vi.fn(),
}));

vi.mock('@/lib/reservations/share', () => ({
  shareReservationDetails: vi.fn(),
}));

vi.mock('@features/reservations/wizard/api/useReservation', () => ({
  useReservation: (...args: unknown[]) => useReservationMock(...args),
}));

vi.mock('@/components/features/booking/detail/ReservationHistory', () => ({
  ReservationHistory: () => <div data-testid="reservation-history" />,
}));

import ReservationDetailClient from '@/components/features/booking/detail/ReservationDetailClient';

const reservation = {
  id: 'booking-1',
  restaurantId: 'rest-1',
  restaurantName: 'The Fox',
  restaurantSlug: 'the-fox',
  restaurantTimezone: 'Europe/London',
  partySize: 2,
  startAt: '2026-05-01T18:30:00.000Z',
  endAt: '2026-05-01T20:00:00.000Z',
  status: 'confirmed',
  notes: 'Window please',
  customerName: 'Guest Booker',
  customerEmail: 'guest@example.com',
  customerPhone: '+441234567890',
  seatingPreference: 'Indoor',
  reference: 'NB1234',
  createdAt: '2026-04-01T10:00:00.000Z',
};

describe('ReservationDetailClient', () => {
  beforeEach(() => {
    pushMock.mockReset();
    useReservationMock.mockReset();
    useReservationMock.mockReturnValue({
      data: reservation,
      error: null,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
      isFetching: false,
    });
  });

  it('renders booking details and opens the edit dialog for manageable bookings', async () => {
    const user = userEvent.setup();

    render(
      <ReservationDetailClient
        reservationId={reservation.id}
        restaurantName={reservation.restaurantName}
        initialNow={Date.parse('2026-04-15T12:00:00.000Z')}
        canManage
      />,
    );

    expect(screen.getByText('The Fox')).toBeInTheDocument();
    expect(screen.getByText('NB1234')).toBeInTheDocument();
    expect(screen.getByText('Window please')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modify Details' })).toBeEnabled();
    expect(screen.getByTestId('reservation-history')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Modify Details' }));

    expect(screen.getByTestId('reservation-dialog-open')).toBeInTheDocument();
  });

  it('opens the cancel dialog for manageable bookings', async () => {
    const user = userEvent.setup();

    render(
      <ReservationDetailClient
        reservationId={reservation.id}
        restaurantName={reservation.restaurantName}
        initialNow={Date.parse('2026-04-15T12:00:00.000Z')}
        canManage
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel Booking' }));

    expect(screen.getByTestId('reservation-dialog-open')).toBeInTheDocument();
  });
});
