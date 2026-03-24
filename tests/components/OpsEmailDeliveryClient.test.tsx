import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { OpsEmailDeliveryClient } from '@/components/features/email-delivery/OpsEmailDeliveryClient';
import { OpsSidebarLayout } from '@/components/features/ops-shell/OpsSidebarLayout';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';

import type { BookingService } from '@/services/ops/bookings';
import type { OpsMembership, OpsUser } from '@/types/ops';

const replaceMock = vi.fn();

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    usePathname: () => '/app/email-delivery',
    useRouter: () => ({ replace: replaceMock }),
    useSearchParams: () => new URLSearchParams('restaurantId=rest-1&tab=delivery-log'),
  };
});

const user: OpsUser = {
  id: 'user-1',
  email: 'ops@example.com',
};

const memberships: OpsMembership[] = [
  {
    id: 'membership-1',
    restaurantId: 'rest-1',
    restaurantName: 'Test Restaurant',
    role: 'owner',
  },
];

function createRestaurantService() {
  return {
    getRestaurant: vi.fn().mockResolvedValue({
      id: 'rest-1',
      name: 'Test Restaurant',
      timezone: 'UTC',
    }),
    listRestaurants: vi.fn().mockResolvedValue([]),
  };
}

function createBookingServiceMock(
  getRestaurantEmailDeliveryFeed: BookingService['getRestaurantEmailDeliveryFeed'],
) {
  return {
    getRestaurantEmailDeliveryFeed,
    getRestaurantEmailQueue: vi.fn().mockResolvedValue({
      ok: true,
      restaurantId: 'rest-1',
      pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 0 },
      summary: { total: 0, waiting: 0, active: 0, delayed: 0, dlq: 0 },
      jobs: [],
      timestamp: new Date().toISOString(),
    }),
  } as unknown as BookingService;
}

function renderClient(getRestaurantEmailDeliveryFeed: BookingService['getRestaurantEmailDeliveryFeed']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider
        factories={{
          bookingService: () => createBookingServiceMock(getRestaurantEmailDeliveryFeed),
          restaurantService: () => createRestaurantService() as never,
        }}
      >
        <OpsSessionProvider user={user} memberships={memberships} initialRestaurantId="rest-1">
          <OpsSidebarLayout>
            <OpsEmailDeliveryClient initialRestaurantId="rest-1" initialRange="7d" />
          </OpsSidebarLayout>
        </OpsSessionProvider>
      </OpsServicesProvider>
    </QueryClientProvider>,
  );
}

describe('OpsEmailDeliveryClient', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('shows a retryable alert when the API returns an error response', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValueOnce({
        ok: false,
        code: 'INTERNAL',
        error: 'Delivery feed timed out',
        message: 'Delivery feed timed out',
      })
      .mockResolvedValueOnce({
        ok: true,
        restaurantId: 'rest-1',
        range: '7d',
        pageInfo: { page: 1, pageSize: 50, hasNext: false },
        attempts: [],
        summary: {
          total: 0,
          sent: 0,
          delivered: 0,
          deliveryDelayed: 0,
          bounced: 0,
          complained: 0,
          failed: 0,
          deliveredRate: 0,
          failureRate: 0,
          uniqueRecipients: 0,
          uniqueBookings: 0,
          p50DeliverySeconds: null,
          p95DeliverySeconds: null,
          topFailedTemplates: [],
          topFailedEmailTypes: [],
        },
      });

    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Unable to load email delivery attempts')).toBeInTheDocument();
    expect(screen.getByText('Delivery feed timed out')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(getRestaurantEmailDeliveryFeed).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('No email deliveries found')).toBeInTheDocument();
  });

  it('normalizes network errors into a meaningful retryable alert message', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        restaurantId: 'rest-1',
        range: '7d',
        pageInfo: { page: 1, pageSize: 50, hasNext: false },
        attempts: [],
        summary: {
          total: 0,
          sent: 0,
          delivered: 0,
          deliveryDelayed: 0,
          bounced: 0,
          complained: 0,
          failed: 0,
          deliveredRate: 0,
          failureRate: 0,
          uniqueRecipients: 0,
          uniqueBookings: 0,
          p50DeliverySeconds: null,
          p95DeliverySeconds: null,
          topFailedTemplates: [],
          topFailedEmailTypes: [],
        },
      });

    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText('We could not reach the delivery log service. Check your connection and try again.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(getRestaurantEmailDeliveryFeed).toHaveBeenCalledTimes(2);
    });
  });

  it('marks the Email Delivery sidebar item as active on this page', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue({
        ok: true,
        restaurantId: 'rest-1',
        range: '7d',
        pageInfo: { page: 1, pageSize: 50, hasNext: false },
        attempts: [],
        summary: {
          total: 0,
          sent: 0,
          delivered: 0,
          deliveryDelayed: 0,
          bounced: 0,
          complained: 0,
          failed: 0,
          deliveredRate: 0,
          failureRate: 0,
          uniqueRecipients: 0,
          uniqueBookings: 0,
          p50DeliverySeconds: null,
          p95DeliverySeconds: null,
          topFailedTemplates: [],
          topFailedEmailTypes: [],
        },
      });

    renderClient(getRestaurantEmailDeliveryFeed);

    const link = await screen.findByRole('link', { name: /email delivery/i });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link.closest('[data-active="true"]')).not.toBeNull();

    const bookingsLink = screen.getByRole('link', { name: /^bookings$/i });
    expect(bookingsLink.closest('[data-active="true"]')).toBeNull();

    const emptyState = await screen.findByText('No email deliveries found');
    expect(within(emptyState.closest('div') as HTMLElement).getByText(/adjust the filters or try a wider date range/i)).toBeInTheDocument();
  });
});
