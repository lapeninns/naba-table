import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpsEmailDeliveryClient } from '@/components/features/email-delivery/OpsEmailDeliveryClient';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';
import { OpsUnsavedChangesProvider } from '@/contexts/ops-unsaved-changes';

import type { BookingService } from '@/services/ops/bookings';
import type { OpsEmailDeliveryFeedResponse, OpsEmailDeliverySummary } from '@/types/emailDelivery';
import type { OpsMembership, OpsUser } from '@/types/ops';

const { toastSuccessMock, toastErrorMock, routerReplaceMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  routerReplaceMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

const pathnameMock = vi.fn();
const searchParamsMock = vi.fn();

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation');
  return {
    ...actual,
    usePathname: () => pathnameMock(),
    useSearchParams: () => searchParamsMock(),
    useRouter: () => ({
      replace: routerReplaceMock,
    }),
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

function makeSummary(total = 0): OpsEmailDeliverySummary {
  return {
    total,
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
  };
}

function makeSuccessResponse(
  overrides: Partial<Extract<OpsEmailDeliveryFeedResponse, { ok: true }>> = {},
): Extract<OpsEmailDeliveryFeedResponse, { ok: true }> {
  return {
    ok: true,
    restaurantId: 'rest-1',
    range: '7d',
    pageInfo: { page: 1, pageSize: 50, hasNext: false },
    attempts: [],
    summary: makeSummary(),
    ...overrides,
  };
}

function createRestaurantService() {
  return {
    listRestaurants: vi.fn().mockResolvedValue([
      { id: 'rest-1', name: 'Test Restaurant', timezone: 'UTC' },
    ]),
    getRestaurant: vi.fn().mockResolvedValue({
      id: 'rest-1',
      name: 'Test Restaurant',
      timezone: 'UTC',
    }),
    getProfile: vi.fn().mockResolvedValue({
      id: 'rest-1',
      name: 'Test Restaurant',
      timezone: 'UTC',
    }),
  };
}

function renderClient(options?: {
  getRestaurantEmailDeliveryFeed?: BookingService['getRestaurantEmailDeliveryFeed'];
  getRestaurantEmailDeliverySummary?: BookingService['getRestaurantEmailDeliverySummary'];
  getRestaurantEmailQueue?: BookingService['getRestaurantEmailQueue'];
  retryEmailDelivery?: BookingService['retryEmailDelivery'];
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  const getRestaurantEmailDeliveryFeed =
    options?.getRestaurantEmailDeliveryFeed ??
    vi.fn<BookingService['getRestaurantEmailDeliveryFeed']>().mockResolvedValue(makeSuccessResponse());
  const getRestaurantEmailDeliverySummary =
    options?.getRestaurantEmailDeliverySummary ??
    vi.fn<BookingService['getRestaurantEmailDeliverySummary']>().mockResolvedValue({
      ok: true,
      restaurantId: 'rest-1',
      range: '7d',
      summary: makeSummary(3),
    });
  const getRestaurantEmailQueue =
    options?.getRestaurantEmailQueue ??
    vi.fn<BookingService['getRestaurantEmailQueue']>().mockResolvedValue({
      ok: true,
      restaurantId: 'rest-1',
      pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 0 },
      summary: { total: 0, waiting: 0, active: 0, delayed: 0, dlq: 0 },
      jobs: [],
      timestamp: new Date().toISOString(),
    });
  const retryEmailDelivery =
    options?.retryEmailDelivery ??
    vi.fn<BookingService['retryEmailDelivery']>().mockResolvedValue({
      ok: true,
      deliveryLogEntry: {},
    });

  render(
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider
        factories={{
          bookingService: () =>
            ({
              getRestaurantEmailDeliveryFeed,
              getRestaurantEmailDeliverySummary,
              getRestaurantEmailQueue,
              retryEmailDelivery,
            }) as unknown as BookingService,
          restaurantService: () => createRestaurantService() as never,
        }}
      >
        <OpsSessionProvider user={user} memberships={memberships} initialRestaurantId="rest-1">
          <OpsUnsavedChangesProvider>
            <OpsEmailDeliveryClient initialRestaurantId="rest-1" initialRange="7d" />
          </OpsUnsavedChangesProvider>
        </OpsSessionProvider>
      </OpsServicesProvider>
    </QueryClientProvider>,
  );

  return {
    getRestaurantEmailDeliveryFeed,
    getRestaurantEmailDeliverySummary,
    getRestaurantEmailQueue,
    retryEmailDelivery,
  };
}

describe('OpsEmailDeliveryClient', () => {
  beforeEach(() => {
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    routerReplaceMock.mockReset();
    pathnameMock.mockReset();
    pathnameMock.mockReturnValue('/app/email-delivery');
    searchParamsMock.mockReset();
    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1&tab=delivery-log'));
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

  it('renders the delivery log and switches to analytics and queue tabs', async () => {
    const user = userEvent.setup();
    const { getRestaurantEmailDeliverySummary, getRestaurantEmailQueue } = renderClient({
      getRestaurantEmailDeliveryFeed: vi
        .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
        .mockResolvedValue(
          makeSuccessResponse({
            attempts: [
              {
                id: 'log-delivered',
                messageId: 'msg-1',
                recipientEmail: 'alex@example.com',
                bookingId: 'booking-1',
                emailType: 'created',
                templateType: 'booking_confirmation',
                provider: 'resend',
                currentStatus: 'delivered',
                currentOccurredAt: '2026-03-20T14:30:00Z',
                events: [
                  {
                    id: 'evt-1',
                    bookingId: 'booking-1',
                    restaurantId: 'rest-1',
                    emailType: 'created',
                    templateType: 'booking_confirmation',
                    recipientEmail: 'alex@example.com',
                    messageId: 'msg-1',
                    status: 'delivered',
                    provider: 'resend',
                    occurredAt: '2026-03-20T14:30:00Z',
                    error: null,
                    metadata: { subject: 'Booking confirmed' },
                  },
                ],
                booking: {
                  id: 'booking-1',
                  reference: 'REF001',
                  bookingDate: '2026-03-20',
                  startTime: '19:00',
                  endTime: '20:30',
                  customerName: 'Alex Johnson',
                  partySize: 4,
                },
              },
            ],
            summary: makeSummary(1),
          }),
        ),
    });

    expect(await screen.findByRole('heading', { name: 'Email Delivery' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /message delivery/i })).toHaveAttribute(
      'href',
      '/app/communications-delivery/messages',
    );
    expect(await screen.findByText('Booking confirmed')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /analytics/i }));
    expect(screen.getByRole('tab', { name: /analytics/i, selected: true })).toBeInTheDocument();
    await waitFor(() => {
      expect(getRestaurantEmailDeliverySummary).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: 'rest-1' }),
      );
    });
    expect(await screen.findByText('Delivery analytics')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /queue/i }));
    expect(screen.getByRole('tab', { name: /queue/i, selected: true })).toBeInTheDocument();
    await waitFor(() => {
      expect(getRestaurantEmailQueue).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: 'rest-1' }),
      );
    });
    expect(await screen.findByText('Scheduled email queue')).toBeInTheDocument();
  });

  it('retries a failed row with restaurantId and deliveryLogId', async () => {
    const user = userEvent.setup();
    const retryEmailDelivery = vi.fn<BookingService['retryEmailDelivery']>().mockResolvedValue({
      ok: true,
      deliveryLogEntry: {},
    });

    renderClient({
      retryEmailDelivery,
      getRestaurantEmailDeliveryFeed: vi
        .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
        .mockResolvedValue(
          makeSuccessResponse({
            attempts: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                messageId: 'provider-message-id-failed',
                recipientEmail: 'failed@example.com',
                bookingId: 'booking-failed',
                emailType: 'created',
                templateType: 'booking_confirmation',
                provider: 'resend',
                currentStatus: 'failed',
                currentOccurredAt: '2026-03-20T15:00:00Z',
                events: [],
                booking: null,
              },
            ],
            summary: makeSummary(1),
          }),
        ),
    });

    await user.click(
      await screen.findByRole('button', { name: /retry email for failed@example.com/i }),
    );
    await user.click(screen.getByRole('button', { name: /confirm retry/i }));

    await waitFor(() => {
      expect(retryEmailDelivery).toHaveBeenCalledWith({
        restaurantId: 'rest-1',
        deliveryLogId: '11111111-1111-4111-8111-111111111111',
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Retry queued', {
      description: 'Resending created to failed@example.com.',
    });
  });
});
