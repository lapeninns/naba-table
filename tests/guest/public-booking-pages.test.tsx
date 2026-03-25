import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BookingsLandingPage from '@src/app/(public)/bookings/page';
import BookingDetailPage from '@src/app/(public)/bookings/[bookingId]/page';
import GuestBookingDetailPage from '@src/app/guest/bookings/[bookingId]/page';
import ReservationDetailClient from '@/components/features/booking/detail/ReservationDetailClient';

import type { ReactNode } from 'react';

const redirect = vi.hoisted(() =>
  vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
);

const cookiesMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const getServerComponentSupabaseClientMock = vi.hoisted(() => vi.fn());
const validateSessionRecoveryAccessTokenMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect,
  useRouter: () => ({
    push: pushMock,
  }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('next/headers', () => ({ cookies: cookiesMock }));
vi.mock('@/server/supabase', () => ({
  getServerComponentSupabaseClient: getServerComponentSupabaseClientMock,
}));
vi.mock('@/server/security/session-recovery-access-token', () => ({
  validateSessionRecoveryAccessToken: validateSessionRecoveryAccessTokenMock,
}));
vi.mock('@/lib/site-url', () => ({
  getTrustedSiteOrigin: () => 'http://localhost:3000',
}));
vi.mock('@/lib/env', () => ({
  env: {
    security: {
      sessionRecoveryAccessTokenSecret: 'test-secret',
    },
  },
}));
vi.mock('@/components/features/booking/detail/ReservationHistory', () => ({
  ReservationHistory: () => <div>Reservation history</div>,
}));
vi.mock('@/components/features/dashboard/CancelBookingDialog', () => ({
  CancelBookingDialog: () => <div>Cancel dialog</div>,
}));
vi.mock('@/components/features/dashboard/EditBookingDialog', () => ({
  EditBookingDialog: () => <div>Edit dialog</div>,
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
const useReservationMock = vi.hoisted(() => vi.fn());

vi.mock('@features/reservations/wizard/api/useReservation', () => ({
  useReservation: useReservationMock,
}));

function createCookieStore(cookies: Array<{ name: string; value: string }> = []) {
  return {
    getAll: () => cookies,
    get: (name: string) => cookies.find((cookie) => cookie.name === name),
  };
}

function createReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    restaurantId: 'restaurant-1',
    restaurantName: 'The Fox',
    restaurantSlug: 'the-fox',
    restaurantTimezone: 'Europe/London',
    partySize: 2,
    startAt: '2026-02-10T19:00:00.000Z',
    endAt: '2026-02-10T20:30:00.000Z',
    status: 'confirmed',
    notes: 'Window table please',
    reference: 'NB1234',
    customerName: 'Guest Booker',
    customerEmail: 'guest@example.com',
    customerPhone: '+441234567890',
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

describe('public booking pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirect.mockClear();
    cookiesMock.mockResolvedValue(createCookieStore());
    getUserMock.mockResolvedValue({ data: { user: null } });
    getServerComponentSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
    });
    validateSessionRecoveryAccessTokenMock.mockReturnValue({ ok: false, reason: 'invalid' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn(),
    } as unknown as Response);
  });

  it('clarifies starting a booking versus managing bookings on /bookings', () => {
    render(<BookingsLandingPage />);

    expect(screen.getByRole('heading', { name: 'Your Reservations' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Book a table' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Manage bookings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse restaurants' })).toHaveAttribute(
      'href',
      '/restaurants',
    );
    expect(screen.getByRole('link', { name: 'View my bookings' })).toHaveAttribute(
      'href',
      '/guest/bookings',
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/auth/signin?redirectedFrom=/bookings',
    );
  });

  it('redirects unauthenticated public booking detail requests to sign-in with preserved intent', async () => {
    await expect(
      BookingDetailPage({
        params: Promise.resolve({ bookingId: 'booking-1' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_REDIRECT:/auth/signin?redirectedFrom=%2Fbookings%2Fbooking-1');
  });

  it('redirects legacy token query access through the recovery error path', async () => {
    await expect(
      BookingDetailPage({
        params: Promise.resolve({ bookingId: 'booking-1' }),
        searchParams: Promise.resolve({ token: 'legacy-token' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT:/bookings/recover/error?code=LEGACY_TOKEN_DEPRECATED');
  });

  it('passes the same shared detail model to the guest booking detail route', async () => {
    cookiesMock.mockResolvedValue(createCookieStore([{ name: 'sr_access', value: 'session-token' }]));
    validateSessionRecoveryAccessTokenMock.mockReturnValue({ ok: true });
    getUserMock.mockResolvedValue({ data: { user: { id: 'guest-1' } } });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        booking: {
          id: 'booking-1',
          restaurant_id: 'restaurant-1',
          booking_date: '2026-02-10',
          start_time: '19:00',
          end_time: '20:30',
          start_at: '2026-02-10T19:00:00.000Z',
          end_at: '2026-02-10T20:30:00.000Z',
          status: 'confirmed',
          party_size: 2,
          customer_name: 'Guest Booker',
          customer_email: 'guest@example.com',
          customer_phone: '+441234567890',
          reference: 'NB1234',
          restaurants: {
            name: 'The Fox',
            slug: 'the-fox',
            timezone: 'Europe/London',
          },
        },
      }),
    } as unknown as Response);

    const page = await GuestBookingDetailPage({
      params: Promise.resolve({ bookingId: 'booking-1' }),
      searchParams: Promise.resolve({}),
    });

    expect(page).toBeTruthy();
  });
});

describe('ReservationDetailClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a structured loading state instead of a blank shell', () => {
    useReservationMock.mockReturnValue({
      data: undefined,
      error: null,
      isError: false,
      isLoading: true,
      refetch: vi.fn(),
      isFetching: false,
    });

    renderWithQuery(
      <ReservationDetailClient
        reservationId="booking-1"
        restaurantName="The Fox"
        initialNow={Date.parse('2026-02-01T12:00:00.000Z')}
        canManage
      />,
    );

    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('shows a retryable error state with fallback navigation', () => {
    const refetch = vi.fn();
    useReservationMock.mockReturnValue({
      data: undefined,
      error: new Error('Unable to load reservation'),
      isError: true,
      isLoading: false,
      refetch,
      isFetching: false,
    });

    renderWithQuery(
      <ReservationDetailClient
        reservationId="booking-1"
        restaurantName="The Fox"
        initialNow={Date.parse('2026-02-01T12:00:00.000Z')}
        canManage
      />,
    );

    expect(screen.getByText('Unable to load reservation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to dashboard' })).toHaveAttribute(
      'href',
      '/guest/dashboard',
    );
  });

  it('disables management actions and explains non-manageable cancelled bookings', () => {
    useReservationMock.mockReturnValue({
      data: createReservation({ status: 'cancelled' }),
      error: null,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
      isFetching: false,
    });

    renderWithQuery(
      <ReservationDetailClient
        reservationId="booking-1"
        restaurantName="The Fox"
        initialNow={Date.parse('2026-02-01T12:00:00.000Z')}
        canManage
      />,
    );

    expect(screen.getByRole('button', { name: 'Modify Details' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel Booking' })).toBeDisabled();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Book Again' })).toBeEnabled();
  });

  it('disables management actions and explains pending review lock guidance', () => {
    useReservationMock.mockReturnValue({
      data: createReservation({
        status: 'pending',
        createdAt: '2026-02-01T10:00:00.000Z',
      }),
      error: null,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
      isFetching: false,
    });

    renderWithQuery(
      <ReservationDetailClient
        reservationId="booking-1"
        restaurantName="The Fox"
        initialNow={Date.parse('2026-02-02T12:00:00.000Z')}
        canManage
      />,
    );

    expect(screen.getByRole('button', { name: 'Modify Details' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel Booking' })).toBeDisabled();
    expect(screen.getByText('Pending Confirmation')).toBeInTheDocument();
  });

  it('shows lifecycle status and next actions for visible reservations', () => {
    useReservationMock.mockReturnValue({
      data: createReservation({ status: 'confirmed', startAt: '2026-02-10T19:00:00.000Z' }),
      error: null,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
      isFetching: false,
    });

    renderWithQuery(
      <ReservationDetailClient
        reservationId="booking-1"
        restaurantName="The Fox"
        initialNow={Date.parse('2026-02-10T12:00:00.000Z')}
        canManage
      />,
    );

    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modify Details' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel Booking' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Book Again' })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /PDF/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Share/i }).length).toBeGreaterThan(0);
  });
});
