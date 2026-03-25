import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BookingsLandingPage from '@src/app/(public)/bookings/page';
import BookingDetailPage from '@src/app/(public)/bookings/[bookingId]/page';
import GuestBookingDetailPage from '@src/app/guest/bookings/[bookingId]/page';
import DevBookingRecoveryPage from '@src/app/(public)/dev/booking-recovery/page';
import DevBookingDetailComparisonPage from '@src/app/(public)/dev/booking-detail-comparison/page';
import { BookingDetailPage } from '@src/app/(public)/bookings/booking-page';
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
const createSessionRecoveryAccessTokenMock = vi.hoisted(() => vi.fn());
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
  createSessionRecoveryAccessToken: createSessionRecoveryAccessTokenMock,
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
  resetEnvCache: vi.fn(),
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
    customerEmail: 'guest+active@example.com',
    customerPhone: '+441111111111',
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
    vi.resetModules();
    redirect.mockClear();
    cookiesMock.mockResolvedValue(createCookieStore());
    getUserMock.mockResolvedValue({ data: { user: null } });
    getServerComponentSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: getUserMock,
      },
    });
    validateSessionRecoveryAccessTokenMock.mockReturnValue({ ok: false, reason: 'invalid' });
    createSessionRecoveryAccessTokenMock.mockReturnValue('continuation-token');
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
    ).rejects.toThrow('NEXT_REDIRECT:/auth/signin?redirectedFrom=%2Fbookings%2Frecover%3Fnext%3D%252Fbookings%252Fbooking-1');
  });

  it('keeps valid recovery-cookie revisits entitled after token stripping', async () => {
    cookiesMock.mockResolvedValue(createCookieStore([{ name: 'sr_access', value: 'session-token' }]));
    getUserMock.mockResolvedValue({ data: { user: null } });
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          booking: {
            id: 'booking-1',
            restaurant_id: 'restaurant-1',
            customer_email: 'guest@example.com',
            customer_phone: '+441234567890',
          },
        }),
      } as unknown as Response);
    validateSessionRecoveryAccessTokenMock.mockReturnValueOnce({ ok: true });
    const page = await BookingDetailPage({
      params: Promise.resolve({ bookingId: 'booking-1' }),
      searchParams: Promise.resolve({}),
    });

    expect(page).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/api/bookings/booking-1', {
      headers: {
        accept: 'application/json',
        cookie: 'sr_access=session-token',
      },
      cache: 'no-store',
    });
  });

  it('preserves canonical detail query state in unauthenticated manage-route continuity', async () => {
    await expect(
      BookingDetailPage({
        params: Promise.resolve({ bookingId: 'booking-1' }),
        searchParams: Promise.resolve({ tab: 'details', source: 'email' }),
      }),
    ).rejects.toThrow(
      'NEXT_REDIRECT:/auth/signin?redirectedFrom=%2Fbookings%2Frecover%3Fnext%3D%252Fbookings%252Fbooking-1%253Ftab%253Ddetails%2526source%253Demail',
    );
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

  it('preserves guest-route continuity for unauthenticated guest booking detail visits', async () => {
    await expect(async () =>
      BookingDetailPage({
        params: Promise.resolve({ bookingId: 'booking-1' }),
        searchParams: Promise.resolve({ fixture: 'cancelled' }),
      }),
    ).rejects.toThrow(
      'NEXT_REDIRECT:/auth/signin?redirectedFrom=%2Fbookings%2Frecover%3Fnext%3D%252Fbookings%252Fbooking-1%253Ffixture%253Dcancelled',
    );
  });

  it('renders a usable dev booking recovery link when the recovery secret is configured', async () => {
    process.env.SESSION_RECOVERY_ACCESS_TOKEN_SECRET = 'test-secret';
    createSessionRecoveryAccessTokenMock.mockReturnValue('dev-recovery-token');

    render(
      await DevBookingRecoveryPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText('Generated from configured secret')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open recovery link' })).toHaveAttribute(
      'href',
      '/bookings/recover?access_token=dev-recovery-token&next=%2Fbookings%2F22222222-2222-4222-8222-222222222222',
    );
    expect(createSessionRecoveryAccessTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'guest+active@example.com',
        phone: '+441111111111',
      }),
    );
    expect(screen.getByRole('link', { name: 'Auto-start recovery flow' })).toHaveAttribute(
      'href',
      '/dev/booking-recovery?fixture=active&autoStart=1',
    );
    expect(screen.getByText('Active booking detail + receipt')).toBeInTheDocument();
  });

  it('auto-starts the recovery flow when requested and no recovery session exists yet', async () => {
    createSessionRecoveryAccessTokenMock.mockReturnValue('dev-recovery-token');
    cookiesMock.mockResolvedValue(createCookieStore());

    await expect(
      DevBookingRecoveryPage({
        searchParams: Promise.resolve({ fixture: 'active', autoStart: '1' }),
      }),
    ).rejects.toThrow(
      'NEXT_REDIRECT:/bookings/recover?access_token=dev-recovery-token&next=%2Fbookings%2F22222222-2222-4222-8222-222222222222',
    );
  });

  it('treats invalid recovery cookies as unauthenticated and rebuilds sign-in recovery intent', async () => {
    cookiesMock.mockResolvedValue(createCookieStore([{ name: 'sr_access', value: 'invalid-cookie-token' }]));
    validateSessionRecoveryAccessTokenMock.mockReturnValue({ ok: false, reason: 'invalid_format' });

    await expect(
      BookingDetailPage({
        params: Promise.resolve({ bookingId: 'booking-1' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow(
      'NEXT_REDIRECT:/auth/signin?redirectedFrom=%2Fbookings%2Frecover%3Fnext%3D%252Fbookings%252Fbooking-1',
    );

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('renders the mocked booking-detail comparison harness without shared auth state', async () => {
    createSessionRecoveryAccessTokenMock.mockReturnValue('comparison-token');
    useReservationMock.mockImplementation((reservationId: string) => {
      if (reservationId === '44444444-4444-4444-8444-444444444444') {
        return {
          data: createReservation({
            id: '44444444-4444-4444-8444-444444444444',
            reference: 'NB9012',
            status: 'pending',
            startAt: '2026-02-12T18:30:00.000Z',
            endAt: '2026-02-12T20:00:00.000Z',
          }),
          error: null,
          isError: false,
          isLoading: false,
          refetch: vi.fn(),
          isFetching: false,
        };
      }

      return {
        data: createReservation(),
        error: null,
        isError: false,
        isLoading: false,
        refetch: vi.fn(),
        isFetching: false,
      };
    });

    renderWithQuery(
      await DevBookingDetailComparisonPage({
        searchParams: Promise.resolve({ fixture: 'pending' }),
      }),
    );

    expect(screen.getByRole('heading', { name: 'Public and guest booking detail comparison' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Public booking detail fixture' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Guest booking detail fixture' })).toBeInTheDocument();
    expect(screen.getAllByText('Pending Confirmation').length).toBeGreaterThanOrEqual(2);
  });

  it('shows deterministic setup guidance when the recovery secret is unavailable', async () => {
    vi.doMock('@/lib/env', () => ({
      env: {
        security: {
          sessionRecoveryAccessTokenSecret: null,
        },
      },
    }));
    const { default: DevBookingRecoveryPageWithoutSecret } = await import(
      '@src/app/(public)/dev/booking-recovery/page'
    );

    render(
      await DevBookingRecoveryPageWithoutSecret({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByText('Missing secret configuration')).toBeInTheDocument();
    expect(screen.getByText(/standard mission setup provisions that secret/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open recovery link' })).not.toBeInTheDocument();
    vi.doUnmock('@/lib/env');
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

  it('preserves the public booking return path for the sign-in CTA when rendered on the public route', () => {
    useReservationMock.mockReturnValue({
      data: createReservation({ status: 'confirmed' }),
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
        canManage={false}
        signInReturnPath="/bookings/recover?next=%2Fbookings%2Fbooking-1"
      />,
    );

    expect(screen.getByRole('link', { name: 'Sign In →' })).toHaveAttribute(
      'href',
      '/auth/signin?redirectedFrom=%2Fbookings%2Frecover%3Fnext%3D%252Fbookings%252Fbooking-1',
    );
  });

  it('keeps the guest booking return path as the default sign-in CTA target', () => {
    useReservationMock.mockReturnValue({
      data: createReservation({ status: 'confirmed' }),
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
        canManage={false}
      />,
    );

    expect(screen.getByRole('link', { name: 'Sign In →' })).toHaveAttribute(
      'href',
      '/auth/signin?redirectedFrom=%2Fguest%2Fbookings%2Fbooking-1',
    );
  });
});
