import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GuestBookingReceiptPage from '@src/app/guest/bookings/[bookingId]/receipt/page';
import { ReceiptClient } from '@src/app/guest/bookings/[bookingId]/receipt/ReceiptClient';

import type { ReactNode } from 'react';

const getUserMock = vi.fn();
const getServerComponentSupabaseClientMock = vi.fn();
const useReservationMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: vi.fn((target?: string) => {
    throw new Error(`NEXT_REDIRECT${target ? `:${target}` : ''}`);
  }),
}));

vi.mock('@/server/supabase', () => ({
  getServerComponentSupabaseClient: () => getServerComponentSupabaseClientMock(),
}));

vi.mock('next/headers', () => ({
  cookies: () => cookiesMock(),
}));

vi.mock('@features/reservations/wizard/api/useReservation', () => ({
  useReservation: (reservationId: string | undefined) => useReservationMock(reservationId),
}));

vi.mock('@/lib/analytics/emit', () => ({
  emit: vi.fn(),
}));

vi.mock('@/lib/reservations/share', () => ({
  shareReservationDetails: vi.fn(),
}));

function createReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    restaurantId: 'restaurant-1',
    restaurantName: 'The Fox',
    restaurantSlug: 'the-fox',
    restaurantTimezone: 'Europe/London',
    partySize: 4,
    startAt: '2026-02-12T18:30:00.000Z',
    endAt: '2026-02-12T20:00:00.000Z',
    status: 'confirmed',
    reference: 'NB5678',
    customerName: 'Receipt Guest',
    customerEmail: 'receipt@example.com',
    customerPhone: '+441234567891',
    createdAt: '2026-02-01T10:00:00.000Z',
    checkedInAt: null,
    ...overrides,
  };
}

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('guest receipt pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookiesMock.mockResolvedValue({
      getAll: () => [],
      get: () => undefined,
    });
    getUserMock.mockResolvedValue({ data: { user: null } });
    getServerComponentSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn(),
    } as unknown as Response);
  });

  it('redirects unauthenticated receipt requests without a token to sign-in', async () => {
    await expect(
      GuestBookingReceiptPage({
        params: Promise.resolve({ bookingId: 'booking-1' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_REDIRECT:/auth/signin?redirectedFrom=%2Fguest%2Fbookings%2Fbooking-1%2Freceipt');
  });

  it('allows tokenized receipt requests without a session', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        booking: {
          id: 'booking-1',
          restaurant_id: 'restaurant-1',
          booking_date: '2026-02-12',
          start_time: '18:30',
          end_time: '20:00',
          start_at: '2026-02-12T18:30:00.000Z',
          end_at: '2026-02-12T20:00:00.000Z',
          status: 'confirmed',
          booking_type: 'dinner',
          seating_preference: 'indoor',
          party_size: 4,
          customer_name: 'Receipt Guest',
          customer_email: 'receipt@example.com',
          customer_phone: '+441234567891',
          reference: 'NB5678',
          restaurants: {
            name: 'The Fox',
            slug: 'the-fox',
            timezone: 'Europe/London',
          },
        },
      }),
    } as unknown as Response);

    const page = await GuestBookingReceiptPage({
      params: Promise.resolve({ bookingId: 'booking-1' }),
      searchParams: Promise.resolve({ token: 'receipt-token' }),
    });

    expect(page).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/bookings/booking-1?token=receipt-token'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});

describe('ReceiptClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows confirmation-oriented receipt details for confirmed bookings', () => {
    useReservationMock.mockReturnValue({
      data: createReservation(),
      error: null,
      isError: false,
      isLoading: false,
    });

    renderWithQuery(<ReceiptClient reservationId="booking-1" hasSession={false} prefetchedStatus="confirmed" />);

    expect(screen.getByText('Save this receipt for easier check-in when you arrive.')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('NB5678')).toBeInTheDocument();
    expect(screen.getByText('A confirmation email has been sent to your inbox.')).toBeInTheDocument();
  });

  it('changes receipt copy for pending bookings', () => {
    useReservationMock.mockReturnValue({
      data: createReservation({ status: 'pending' }),
      error: null,
      isError: false,
      isLoading: false,
    });

    renderWithQuery(<ReceiptClient reservationId="booking-1" hasSession={true} prefetchedStatus="pending" />);

    expect(screen.getByText('Pending Confirmation')).toBeInTheDocument();
    expect(
      screen.getByText('Your request has been received. We’ll confirm the reservation as soon as the venue reviews it.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('We’ll email you as soon as the venue confirms or updates this reservation.'),
    ).toBeInTheDocument();
  });

  it('changes receipt copy for cancelled bookings', () => {
    useReservationMock.mockReturnValue({
      data: createReservation({ status: 'cancelled' }),
      error: null,
      isError: false,
      isLoading: false,
    });

    renderWithQuery(<ReceiptClient reservationId="booking-1" hasSession={true} prefetchedStatus="cancelled" />);

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('This reservation has been cancelled.')).toBeInTheDocument();
    expect(
      screen.getByText('Need another table? You can start a fresh booking whenever you’re ready.'),
    ).toBeInTheDocument();
  });
});
