import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { OpsEmailQueuePanel } from '@/components/features/email-delivery/components/OpsEmailQueuePanel';

import { OpsEmailDeliveryClient } from '@/components/features/email-delivery/OpsEmailDeliveryClient';
import { OpsSidebarLayout } from '@/components/features/ops-shell/OpsSidebarLayout';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';

import type { BookingService } from '@/services/ops/bookings';
import type {
  OpsEmailDeliveryFeedResponse,
  OpsEmailDeliverySummary,
  OpsEmailDeliverySummaryResponse,
} from '@/types/emailDelivery';
import type { OpsEmailQueueFeedResponse } from '@/types/emailQueue';
import type { OpsMembership, OpsUser } from '@/types/ops';

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
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
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    usePathname: () => pathnameMock(),
    useSearchParams: () => searchParamsMock(),
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
  {
    id: 'membership-2',
    restaurantId: '22222222-2222-4222-8222-222222222222',
    restaurantName: 'Second Test Restaurant',
    role: 'manager',
  },
];

function createRestaurantService() {
  return {
    listRestaurants: vi.fn().mockResolvedValue([
      {
        id: 'rest-1',
        name: 'Test Restaurant',
        timezone: 'UTC',
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Second Test Restaurant',
        timezone: 'America/New_York',
      },
    ]),
    getRestaurant: vi.fn().mockResolvedValue({
      id: 'rest-1',
      name: 'Test Restaurant',
      timezone: 'UTC',
    }),
  };
}

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

function createBookingServiceMock(
  getRestaurantEmailDeliveryFeed: BookingService['getRestaurantEmailDeliveryFeed'],
  getRestaurantEmailDeliverySummary: BookingService['getRestaurantEmailDeliverySummary'] = vi.fn().mockResolvedValue({
    ok: true,
    restaurantId: 'rest-1',
    range: '7d',
    summary: makeSummary(),
  }),
  getRestaurantEmailQueue: BookingService['getRestaurantEmailQueue'] = vi.fn().mockResolvedValue({
    ok: true,
    restaurantId: 'rest-1',
    pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 0 },
    summary: { total: 0, waiting: 0, active: 0, delayed: 0, dlq: 0 },
    jobs: [],
    timestamp: new Date().toISOString(),
  }),
  retryEmailDelivery: BookingService['retryEmailDelivery'] = vi.fn().mockResolvedValue({
    ok: true,
    deliveryLogEntry: {},
  }),
) {
  return {
    getRestaurantEmailDeliveryFeed,
    getRestaurantEmailDeliverySummary,
    getRestaurantEmailQueue,
    retryEmailDelivery,
  } as unknown as BookingService;
}

function renderClient(
  getRestaurantEmailDeliveryFeed: BookingService['getRestaurantEmailDeliveryFeed'],
  options?: {
    getRestaurantEmailDeliverySummary?: BookingService['getRestaurantEmailDeliverySummary'];
    getRestaurantEmailQueue?: BookingService['getRestaurantEmailQueue'];
    retryEmailDelivery?: BookingService['retryEmailDelivery'];
  },
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider
        factories={{
          bookingService: () =>
            createBookingServiceMock(
              getRestaurantEmailDeliveryFeed,
              options?.getRestaurantEmailDeliverySummary,
              options?.getRestaurantEmailQueue,
              options?.retryEmailDelivery,
            ),
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
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
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

  afterEach(() => {
    vi.useRealTimers();
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
        ...makeSuccessResponse(),
      });

    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByText('Unable to load email delivery attempts')).toBeInTheDocument();
    expect(screen.getByText('Unable to load email delivery attempts')).toBeInTheDocument();
    expect(screen.getByText('Delivery feed timed out')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(getRestaurantEmailDeliveryFeed).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('No email deliveries found')).toBeInTheDocument();
  });

  it('shows retry actions only for failed and bounced rows and not for delivered rows', async () => {
    const getRestaurantEmailDeliveryFeed = vi.fn<BookingService['getRestaurantEmailDeliveryFeed']>().mockResolvedValue(
      makeSuccessResponse({
        attempts: [
          {
            id: 'delivery-log-id-failed',
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
          {
            id: 'delivery-log-id-delivered',
            messageId: 'provider-message-id-delivered',
            recipientEmail: 'delivered@example.com',
            bookingId: 'booking-delivered',
            emailType: 'updated',
            templateType: 'booking_update',
            provider: 'resend',
            currentStatus: 'delivered',
            currentOccurredAt: '2026-03-20T14:00:00Z',
            events: [],
            booking: null,
          },
          {
            id: 'delivery-log-id-bounced',
            messageId: 'provider-message-id-bounced',
            recipientEmail: 'bounced@example.com',
            bookingId: 'booking-bounced',
            emailType: 'review_request',
            templateType: 'review_request',
            provider: 'resend',
            currentStatus: 'bounced',
            currentOccurredAt: '2026-03-20T16:00:00Z',
            events: [],
            booking: null,
          },
        ],
        summary: makeSummary(3),
      }),
    );

    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByRole('button', { name: /retry email for failed@example.com/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry email for bounced@example.com/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry email for delivered@example.com/i })).not.toBeInTheDocument();
  });


  it('uses the delivery-log UUID instead of the provider message id when retrying a failed row', async () => {
    const user = userEvent.setup();
    const retryEmailDelivery = vi.fn<BookingService['retryEmailDelivery']>().mockResolvedValue({
      ok: true,
      deliveryLogEntry: {},
    });
    const getRestaurantEmailDeliveryFeed = vi
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
      );

    renderClient(getRestaurantEmailDeliveryFeed, { retryEmailDelivery });

    await user.click(await screen.findByRole('button', { name: /retry email for failed@example.com/i }));
    await user.click(screen.getByRole('button', { name: /confirm retry/i }));

    await waitFor(() => {
      expect(retryEmailDelivery).toHaveBeenCalledWith({
        deliveryLogId: '11111111-1111-4111-8111-111111111111',
      });
    });
    expect(retryEmailDelivery).not.toHaveBeenCalledWith({
      deliveryLogId: 'provider-message-id-failed',
    });
  });

  it('confirms retry, calls service, shows success toast, and refetches delivery log', async () => {
    const user = userEvent.setup();
    const retryEmailDelivery = vi.fn<BookingService['retryEmailDelivery']>().mockResolvedValue({
      ok: true,
      deliveryLogEntry: {},
    });
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(
        makeSuccessResponse({
          attempts: [
            {
              messageId: 'delivery-log-id-failed',
              recipientEmail: 'failed@example.com',
              bookingId: 'booking-failed',
              emailType: 'created',
              templateType: 'booking_confirmation',
              provider: 'resend',
              currentStatus: 'failed',
              currentOccurredAt: '2026-03-20T15:00:00Z',
              events: [
                {
                  id: 'evt-1',
                  bookingId: 'booking-failed',
                  restaurantId: 'rest-1',
                  emailType: 'created',
                  templateType: 'booking_confirmation',
                  recipientEmail: 'failed@example.com',
                  messageId: 'delivery-log-id-failed',
                  status: 'failed',
                  provider: 'resend',
                  occurredAt: '2026-03-20T15:00:00Z',
                  error: 'Mailbox unavailable',
                  metadata: { subject: 'Your booking confirmation' },
                },
              ],
              booking: null,
            },
          ],
          summary: makeSummary(1),
        }),
      );

    renderClient(getRestaurantEmailDeliveryFeed, { retryEmailDelivery });

    await user.click(await screen.findByRole('button', { name: /retry email for failed@example.com/i }));

    expect(await screen.findByText('Retry email delivery?')).toBeInTheDocument();
    expect(screen.getAllByText('Your booking confirmation').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /confirm retry/i }));

    await waitFor(() => {
      expect(retryEmailDelivery).toHaveBeenCalledWith({ deliveryLogId: 'delivery-log-id-failed' });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Retry queued', {
      description: 'Resending created to failed@example.com.',
    });
    await waitFor(() => {
      expect(getRestaurantEmailDeliveryFeed).toHaveBeenCalledTimes(2);
    });
  });

  it('shows an error toast and keeps the row unchanged when retry fails', async () => {
    const user = userEvent.setup();
    const retryEmailDelivery = vi
      .fn<BookingService['retryEmailDelivery']>()
      .mockRejectedValue(new Error('Retry service unavailable'));
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(
        makeSuccessResponse({
          attempts: [
            {
              messageId: 'delivery-log-id-failed',
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
      );

    renderClient(getRestaurantEmailDeliveryFeed, { retryEmailDelivery });

    await user.click(await screen.findByRole('button', { name: /retry email for failed@example.com/i }));
    await user.click(screen.getByRole('button', { name: /confirm retry/i }));

    await waitFor(() => {
      expect(retryEmailDelivery).toHaveBeenCalledWith({ deliveryLogId: 'delivery-log-id-failed' });
    });
    expect(toastErrorMock).toHaveBeenCalledWith('Retry failed', {
      description: 'Retry service unavailable',
    });
    expect(screen.getByText('Retry email delivery?')).toBeInTheDocument();
  });

  it('passes simulate retry mutation error through the retry action flow when requested by URL', async () => {
    searchParamsMock.mockReturnValue(
      new URLSearchParams(
        'restaurantId=rest-1&tab=delivery-log&fixture=retry-actions&simulateRetryMutationError=1',
      ),
    );

    const user = userEvent.setup();
    const retryEmailDelivery = vi
      .fn<BookingService['retryEmailDelivery']>()
      .mockRejectedValue(new Error('Forced retry mutation error for dev/test validation.'));
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(
        makeSuccessResponse({
          attempts: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              messageId: 'fixture-provider-message-failed',
              recipientEmail: 'retry.failed@example.com',
              bookingId: 'booking-fixture-failed',
              emailType: 'created',
              templateType: 'booking_confirmation',
              provider: 'mock',
              currentStatus: 'failed',
              currentOccurredAt: '2026-03-24T10:02:00.000Z',
              events: [],
              booking: null,
            },
          ],
          summary: makeSummary(1),
        }),
      );

    renderClient(getRestaurantEmailDeliveryFeed, { retryEmailDelivery });

    await user.click(await screen.findByRole('button', { name: /retry email for retry.failed@example.com/i }));
    await user.click(screen.getByRole('button', { name: /confirm retry/i }));

    await waitFor(() => {
      expect(retryEmailDelivery).toHaveBeenCalledWith({
        deliveryLogId: '11111111-1111-4111-8111-111111111111',
        simulateError: true,
      });
    });
    expect(toastErrorMock).toHaveBeenCalledWith('Retry failed', {
      description: 'Forced retry mutation error for dev/test validation.',
    });
  });

  it('cancels retry without calling the service', async () => {
    const user = userEvent.setup();
    const retryEmailDelivery = vi.fn<BookingService['retryEmailDelivery']>();
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(
        makeSuccessResponse({
          attempts: [
            {
              messageId: 'delivery-log-id-failed',
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
      );

    renderClient(getRestaurantEmailDeliveryFeed, { retryEmailDelivery });

    await user.click(await screen.findByRole('button', { name: /retry email for failed@example.com/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(retryEmailDelivery).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText('Retry email delivery?')).not.toBeInTheDocument();
    });
  });

  it('normalizes network errors into a meaningful retryable alert message', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({
        ...makeSuccessResponse(),
      });

    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByText('Unable to load email delivery attempts')).toBeInTheDocument();
    expect(
      screen.getByText('We could not reach the delivery log service. Check your connection and try again.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(getRestaurantEmailDeliveryFeed).toHaveBeenCalledTimes(2);
    });
  });

  it('shows dev-harness fault-injection guidance and can force the delivery log error state', async () => {
    pathnameMock.mockReturnValue('/dev/ops-email-delivery');
    searchParamsMock.mockReturnValue(
      new URLSearchParams('restaurantId=rest-1&tab=delivery-log&messageId=__force_error__'),
    );

    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue({
        ok: false,
        code: 'FORCED_ERROR',
        error: 'Forced delivery log error for dev/test validation.',
        message: 'Forced delivery log error for dev/test validation.',
      });

    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByText('Dev/test validation control')).toBeInTheDocument();
    expect(screen.getByText(/messageId=__force_error__/i)).toBeInTheDocument();
    expect(await screen.findByText('Unable to load email delivery attempts')).toBeInTheDocument();
    expect(screen.getByText('Forced delivery log error for dev/test validation.')).toBeInTheDocument();
  });

  it('supports simulateEmailDeliveryError=1 on the authenticated validator surface', async () => {
    searchParamsMock.mockReturnValue(
      new URLSearchParams('restaurantId=rest-1&tab=delivery-log&simulateEmailDeliveryError=1'),
    );

    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockImplementation(async (params) => {
        if (params.simulateEmailDeliveryError) {
          return {
            ok: false,
            code: 'FORCED_ERROR',
            error: 'Forced delivery log error for dev/test validation.',
            message: 'Forced delivery log error for dev/test validation.',
          };
        }

        return makeSuccessResponse();
      });

    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Forced delivery log error for dev/test validation.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(getRestaurantEmailDeliveryFeed).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ simulateEmailDeliveryError: true }),
      );
      expect(getRestaurantEmailDeliveryFeed).toHaveBeenCalledTimes(2);
    });
  });

  it('resolves filtered zero-result responses to visible empty guidance once loading settles', async () => {
    searchParamsMock.mockReturnValue(
      new URLSearchParams('restaurantId=rest-1&tab=delivery-log&recipientEmail=zzzz-no-match-empty-state'),
    );

    const responses = [
      makeSuccessResponse({
        attempts: [
          {
            messageId: 'msg-loading',
            recipientEmail: 'prior@example.com',
            bookingId: 'booking-loading',
            emailType: 'created',
            templateType: 'booking_confirmation',
            provider: 'resend',
            currentStatus: 'delivered',
            currentOccurredAt: '2026-03-20T14:30:00Z',
            events: [
              {
                id: 'evt-loading',
                bookingId: 'booking-loading',
                restaurantId: 'rest-1',
                emailType: 'created',
                templateType: 'booking_confirmation',
                recipientEmail: 'prior@example.com',
                messageId: 'msg-loading',
                status: 'delivered',
                provider: 'resend',
                occurredAt: '2026-03-20T14:30:00Z',
                error: null,
                metadata: { subject: 'Previous result' },
              },
            ],
            booking: {
              id: 'booking-loading',
              reference: 'PREV01',
              bookingDate: '2026-03-20',
              startTime: '19:00',
              endTime: '20:30',
              customerName: 'Prior Result',
              partySize: 2,
            },
          },
        ],
        summary: makeSummary(1),
      }),
      makeSuccessResponse({
        attempts: [],
        summary: makeSummary(0),
        pageInfo: { page: 1, pageSize: 50, hasNext: false },
      }),
    ];

    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockImplementation(async () => responses.shift() ?? makeSuccessResponse());

    const { rerender } = renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByText('Previous result')).toBeInTheDocument();

    searchParamsMock.mockReturnValue(
      new URLSearchParams('restaurantId=rest-1&tab=delivery-log&recipientEmail=zzzz-no-match-empty-state&page=2'),
    );

    rerender(
      <QueryClientProvider
        client={new QueryClient({
          defaultOptions: {
            queries: { retry: false, refetchOnWindowFocus: false },
          },
        })}
      >
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

    expect(await screen.findByText('No email deliveries found')).toBeInTheDocument();
    expect(screen.getByText('Adjust the filters or try a wider date range to see more results.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading email delivery attempts')).not.toBeInTheDocument();
    expect(screen.queryByText('Previous result')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('prefers an API error response over stale loading placeholders during a forced-error transition', async () => {
    searchParamsMock.mockReturnValue(
      new URLSearchParams('restaurantId=rest-1&tab=delivery-log&simulateEmailDeliveryError=1'),
    );

    let gateResolved = false;
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = () => {
        gateResolved = true;
        resolve();
      };
    });

    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockImplementation(async () => {
        if (!gateResolved) {
          await gate;
        }

        return {
          ok: false,
          code: 'FORCED_ERROR',
          error: 'Forced delivery log error for dev/test validation.',
          message: 'Forced delivery log error for dev/test validation.',
        };
      });

    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByLabelText('Loading email delivery attempts')).toBeInTheDocument();

    releaseGate();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Forced delivery log error for dev/test validation.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText('Loading email delivery attempts')).not.toBeInTheDocument();
    });
  });

  it('keeps a visible terminal panel mounted when a settled fetch returns no rows after placeholder data existed', async () => {
    searchParamsMock.mockReturnValue(
      new URLSearchParams('restaurantId=rest-1&tab=delivery-log&recipientEmail=zzzz-no-match-empty-state'),
    );

    let resolveSettled!: () => void;
    const settledGate = new Promise<void>((resolve) => {
      resolveSettled = resolve;
    });

    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValueOnce(
        makeSuccessResponse({
          attempts: [
            {
              messageId: 'msg-existing',
              recipientEmail: 'before@example.com',
              bookingId: 'booking-existing',
              emailType: 'created',
              templateType: 'booking_confirmation',
              provider: 'resend',
              currentStatus: 'delivered',
              currentOccurredAt: '2026-03-20T14:30:00Z',
              events: [
                {
                  id: 'evt-existing',
                  bookingId: 'booking-existing',
                  restaurantId: 'rest-1',
                  emailType: 'created',
                  templateType: 'booking_confirmation',
                  recipientEmail: 'before@example.com',
                  messageId: 'msg-existing',
                  status: 'delivered',
                  provider: 'resend',
                  occurredAt: '2026-03-20T14:30:00Z',
                  error: null,
                  metadata: { subject: 'Existing row' },
                },
              ],
              booking: {
                id: 'booking-existing',
                reference: 'EXIST1',
                bookingDate: '2026-03-20',
                startTime: '19:00',
                endTime: '20:30',
                customerName: 'Existing Guest',
                partySize: 2,
              },
            },
          ],
          summary: makeSummary(1),
        }),
      )
      .mockImplementationOnce(async () => {
        await settledGate;
        return makeSuccessResponse({
          attempts: [],
          summary: makeSummary(0),
          pageInfo: { page: 1, pageSize: 50, hasNext: false },
        });
      });

    const { rerender } = renderClient(getRestaurantEmailDeliveryFeed);
    expect(await screen.findByText('Existing row')).toBeInTheDocument();

    searchParamsMock.mockReturnValue(
      new URLSearchParams('restaurantId=rest-1&tab=delivery-log&recipientEmail=zzzz-no-match-empty-state&page=2'),
    );

    rerender(
      <QueryClientProvider
        client={new QueryClient({
          defaultOptions: {
            queries: { retry: false, refetchOnWindowFocus: false },
          },
        })}
      >
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

    resolveSettled();

    expect(await screen.findByText('No email deliveries found')).toBeInTheDocument();
    expect(screen.getByText('Adjust the filters or try a wider date range to see more results.')).toBeInTheDocument();
    expect(screen.queryByText('Existing row')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText('Loading email delivery attempts')).not.toBeInTheDocument();
    });
  });


  it('marks the Email Delivery sidebar item as active on this page', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue({
        ...makeSuccessResponse(),
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

  it('keeps the redesigned delivery log UI path and leaves queue and analytics tabs intact', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(
        makeSuccessResponse({
          summary: makeSummary(2),
          attempts: [
            {
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
        }),
      );

    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByRole('button', { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter by status/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /queue/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /analytics/i })).toBeInTheDocument();
    expect(screen.queryByText(/delivery health/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/showing latest delivery activity/i)).not.toBeInTheDocument();
  });

  it('keeps pagination controls visible on empty out-of-range pages so operators can recover', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(
        makeSuccessResponse({
          pageInfo: { page: 3, pageSize: 50, hasNext: false },
          attempts: [],
          summary: makeSummary(70),
        }),
      );

    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByText('No email deliveries found')).toBeInTheDocument();
    expect(screen.getByText('Showing 0-0 of 70 results')).toBeInTheDocument();
    expect(screen.getAllByText('Page 3').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Prev' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /rows per page/i })).toBeInTheDocument();
  });

  it('keeps explicit empty guidance visible beside pagination recovery controls on empty filtered pages', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(
        makeSuccessResponse({
          pageInfo: { page: 2, pageSize: 50, hasNext: false },
          attempts: [],
          summary: makeSummary(70),
        }),
      );

    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByText('No email deliveries found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Adjust the filters or try a wider date range to see more results.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Showing 0-0 of 70 results')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prev' })).not.toBeDisabled();
  });

  it('shows empty guidance when zero results are returned on the first filtered page', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(
        makeSuccessResponse({
          pageInfo: { page: 1, pageSize: 50, hasNext: false },
          attempts: [],
          summary: makeSummary(0),
        }),
      );

    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByText('No email deliveries found')).toBeInTheDocument();
    expect(screen.getByText('Adjust the filters or try a wider date range to see more results.')).toBeInTheDocument();
    expect(screen.queryByText(/^Showing 0-0 of 0 results$/)).not.toBeInTheDocument();
  });

  it('shows the actual visible range for non-empty pages', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(
        makeSuccessResponse({
          pageInfo: { page: 2, pageSize: 50, hasNext: false },
          attempts: [
            {
              messageId: 'msg-51',
              recipientEmail: 'alex@example.com',
              bookingId: 'booking-51',
              emailType: 'created',
              templateType: 'booking_confirmation',
              provider: 'resend',
              currentStatus: 'delivered',
              currentOccurredAt: '2026-03-20T14:30:00Z',
              events: [
                {
                  id: 'evt-51',
                  bookingId: 'booking-51',
                  restaurantId: 'rest-1',
                  emailType: 'created',
                  templateType: 'booking_confirmation',
                  recipientEmail: 'alex@example.com',
                  messageId: 'msg-51',
                  status: 'delivered',
                  provider: 'resend',
                  occurredAt: '2026-03-20T14:30:00Z',
                  error: null,
                  metadata: { subject: 'Booking confirmed' },
                },
              ],
              booking: {
                id: 'booking-51',
                reference: 'REF051',
                bookingDate: '2026-03-20',
                startTime: '19:00',
                endTime: '20:30',
                customerName: 'Alex Johnson',
                partySize: 4,
              },
            },
            {
              messageId: 'msg-52',
              recipientEmail: 'jamie@example.com',
              bookingId: 'booking-52',
              emailType: 'updated',
              templateType: 'booking_update',
              provider: 'resend',
              currentStatus: 'sent',
              currentOccurredAt: '2026-03-20T15:00:00Z',
              events: [
                {
                  id: 'evt-52',
                  bookingId: 'booking-52',
                  restaurantId: 'rest-1',
                  emailType: 'updated',
                  templateType: 'booking_update',
                  recipientEmail: 'jamie@example.com',
                  messageId: 'msg-52',
                  status: 'sent',
                  provider: 'resend',
                  occurredAt: '2026-03-20T15:00:00Z',
                  error: null,
                  metadata: { subject: 'Booking updated' },
                },
              ],
              booking: {
                id: 'booking-52',
                reference: 'REF052',
                bookingDate: '2026-03-20',
                startTime: '20:00',
                endTime: '21:30',
                customerName: 'Jamie Lee',
                partySize: 2,
              },
            },
          ],
          summary: makeSummary(70),
        }),
      );

    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByText('Showing 51-52 of 70 results')).toBeInTheDocument();
  });

  it('renders the restaurant badge in the shared page header metadata', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(makeSuccessResponse());

    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByText('Test Restaurant')).toBeInTheDocument();
    expect(screen.getByText('UTC')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to bookings/i })).toHaveAttribute('href', '/app/bookings');
  });

  it('updates the active tab via client-side URL replacement while preserving other query params', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(makeSuccessResponse());

    searchParamsMock.mockReturnValue(
      new URLSearchParams('restaurantId=rest-1&tab=delivery-log&range=24h&page=2'),
    );

    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed);

    await user.click(await screen.findByRole('tab', { name: /queue/i }));

    expect(replaceStateSpy).toHaveBeenCalledWith(
      window.history.state,
      '',
      '/app/email-delivery?restaurantId=rest-1&tab=queue&range=24h&page=2',
    );
    expect(screen.getByRole('tab', { name: /queue/i, selected: true })).toBeInTheDocument();
    expect(screen.getByText(/scheduled email queue/i)).toBeInTheDocument();
  });

  it('shows auto-refresh controls, persists refresh to URL, and displays the active interval indicator', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(makeSuccessResponse());

    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByLabelText('Auto-refresh interval')).toBeInTheDocument();
    expect(screen.getByText('Auto-refresh is off.')).toBeInTheDocument();

    await user.click(screen.getByText('30s'));

    expect(replaceStateSpy).toHaveBeenCalledWith(
      window.history.state,
      '',
      '/app/email-delivery?restaurantId=rest-1&refresh=30s',
    );
    expect(screen.getByText('Auto-refresh 30s')).toBeInTheDocument();
  });

  it('passes the selected auto-refresh interval to the active delivery-log query', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(makeSuccessResponse());

    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed);
    await screen.findByText('No email deliveries found');

    await user.click(screen.getByText('1m'));

    expect(screen.getByText('Auto-refresh 1m')).toBeInTheDocument();
    expect(getRestaurantEmailDeliveryFeed).toHaveBeenCalledTimes(1);
  });

  it('manually refreshes the active delivery log tab and spins the refresh icon while fetching', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(makeSuccessResponse());

    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed);

    const refreshButton = await screen.findByRole('button', { name: /refresh current tab/i });
    await user.click(refreshButton);

    expect(refreshButton.querySelector('svg')?.className.baseVal ?? '').toContain('animate-spin');
    const refreshIcon = refreshButton.querySelector('svg');

    await waitFor(() => {
      expect(refreshButton.querySelector('svg')?.className.baseVal ?? '').not.toContain('animate-spin');
    });
  });


  it('repeated manual refresh clicks on the analytics tab eventually restore the refresh button for another click', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(makeSuccessResponse());
    const getRestaurantEmailDeliverySummary = vi
      .fn<BookingService['getRestaurantEmailDeliverySummary']>()
      .mockResolvedValue({
        ok: true,
        restaurantId: 'rest-1',
        range: '7d',
        summary: makeSummary(3),
      });

    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1&tab=analytics'));

    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed, { getRestaurantEmailDeliverySummary });

    const refreshButton = await screen.findByRole('button', { name: /refresh current tab/i });
    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });

    await user.click(refreshButton);
    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });

    await user.click(refreshButton);
    await waitFor(() => {
      expect(refreshButton).not.toBeDisabled();
    });
  });

  it('renders the restaurant switch control with the secondary restaurant option available', async () => {
    searchParamsMock.mockReturnValue(
      new URLSearchParams(
        'restaurantId=rest-1&tab=analytics&range=24h&page=2&pageSize=25&recipientEmail=ops%40example.com&status=failed',
      ),
    );

    const firstRestaurantFeed = makeSuccessResponse({
      restaurantId: 'rest-1',
      range: '24h',
      pageInfo: { page: 2, pageSize: 25, hasNext: false },
      summary: makeSummary(0),
      attempts: [],
    });

    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(firstRestaurantFeed);

    const getRestaurantEmailDeliverySummary = vi
      .fn<BookingService['getRestaurantEmailDeliverySummary']>()
      .mockImplementation(async ({ restaurantId, range }) => ({
        ok: true,
        restaurantId: restaurantId ?? 'rest-1',
        range: range ?? '7d',
        summary: makeSummary(1),
      }));


    renderClient(getRestaurantEmailDeliveryFeed, { getRestaurantEmailDeliverySummary });

    expect(await screen.findByRole('tab', { name: /analytics/i })).toHaveAttribute('aria-selected', 'true');
    expect(getRestaurantEmailDeliveryFeed).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 'rest-1',
        page: 2,
        pageSize: 25,
        recipientEmail: 'ops@example.com',
        status: ['failed'],
      }),
    );

    expect(screen.getByRole('combobox', { name: /restaurant switcher/i })).toBeInTheDocument();
    expect(screen.getByText('UTC')).toBeInTheDocument();
  });


  it('opens analytics deep links from the URL without rewriting restaurant context', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(
        makeSuccessResponse({
          summary: {
            ...makeSummary(12),
            delivered: 10,
            deliveryDelayed: 1,
            failed: 1,
            deliveredRate: 83.3,
            failureRate: 8.3,
            uniqueRecipients: 8,
            uniqueBookings: 6,
          },
        }),
      );
    const getRestaurantEmailDeliverySummary = vi
      .fn<BookingService['getRestaurantEmailDeliverySummary']>()
      .mockResolvedValue({
        ok: true,
        restaurantId: 'rest-1',
        range: '30d',
        summary: {
          ...makeSummary(12),
          delivered: 10,
          deliveryDelayed: 1,
          bounced: 0,
          complained: 0,
          failed: 1,
          deliveredRate: 0.833,
          failureRate: 0.083,
          uniqueRecipients: 8,
          uniqueBookings: 6,
          p50DeliverySeconds: 34,
          p95DeliverySeconds: 155,
          topFailedTemplates: [{ templateType: 'booking_confirmation', count: 1 }],
          topFailedEmailTypes: [{ emailType: 'confirmation', count: 1 }],
        },
      } satisfies Extract<OpsEmailDeliverySummaryResponse, { ok: true }>);

    searchParamsMock.mockReturnValue(
      new URLSearchParams('restaurantId=rest-1&tab=analytics&range=30d&page=2&pageSize=25'),
    );

    renderClient(getRestaurantEmailDeliveryFeed, { getRestaurantEmailDeliverySummary });

    expect(await screen.findByRole('tab', { name: /analytics/i, selected: true })).toBeInTheDocument();
    expect(getRestaurantEmailDeliverySummary).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 'rest-1',
        range: '30d',
        recipientEmail: undefined,
        messageId: undefined,
      }),
    );
    expect(getRestaurantEmailDeliveryFeed).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        pageSize: 25,
      }),
    );
  });

  it('keeps analytics populated independently from delivery-log pagination state and updates range from the analytics toggle', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(
        makeSuccessResponse({
          pageInfo: { page: 2, pageSize: 50, hasNext: false },
          attempts: [],
          summary: undefined,
        }),
      );
    const getRestaurantEmailDeliverySummary = vi
      .fn<BookingService['getRestaurantEmailDeliverySummary']>()
      .mockResolvedValueOnce({
        ok: true,
        restaurantId: 'rest-1',
        range: '7d',
        summary: {
          ...makeSummary(18),
          delivered: 12,
          deliveryDelayed: 2,
          bounced: 1,
          complained: 1,
          failed: 1,
          sent: 1,
          deliveredRate: 0.667,
          failureRate: 0.167,
          uniqueRecipients: 12,
          uniqueBookings: 9,
          p50DeliverySeconds: 40,
          p95DeliverySeconds: 180,
          topFailedTemplates: [{ templateType: 'booking_update', count: 2 }],
          topFailedEmailTypes: [{ emailType: 'updated', count: 2 }],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        restaurantId: 'rest-1',
        range: '24h',
        summary: {
          ...makeSummary(5),
          delivered: 3,
          deliveryDelayed: 1,
          failed: 1,
          deliveredRate: 0.6,
          failureRate: 0.2,
          uniqueRecipients: 5,
          uniqueBookings: 4,
          p50DeliverySeconds: 28,
          p95DeliverySeconds: 90,
          topFailedTemplates: [{ templateType: 'review_request', count: 1 }],
          topFailedEmailTypes: [{ emailType: 'review_request', count: 1 }],
        },
      });

    searchParamsMock.mockReturnValue(
      new URLSearchParams('restaurantId=rest-1&tab=analytics&page=2'),
    );

    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed, { getRestaurantEmailDeliverySummary });

    await waitFor(() => {
      expect(getRestaurantEmailDeliverySummary).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: 'rest-1',
          range: '7d',
        }),
      );
    });

    await user.click(screen.getByText('24h'));

    await waitFor(() => {
      expect(getRestaurantEmailDeliverySummary).toHaveBeenLastCalledWith(
        expect.objectContaining({
          restaurantId: 'rest-1',
          range: '24h',
        }),
      );
    });
    expect(replaceStateSpy).toHaveBeenCalledWith(
      window.history.state,
      '',
      '/app/email-delivery?restaurantId=rest-1&tab=analytics&range=24h',
    );
  });




  it('renders polished queue KPI tiles, filters, table rows, and pagination within the queue tab', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(makeSuccessResponse());
    const getRestaurantEmailQueue = vi
      .fn<BookingService['getRestaurantEmailQueue']>()
      .mockResolvedValue({
        ok: true,
        restaurantId: 'rest-1',
        pageInfo: { page: 1, pageSize: 25, hasNext: true, total: 3 },
        summary: { total: 3, waiting: 1, active: 1, delayed: 1, dlq: 0 },
        jobs: [
          {
            id: 'job-1',
            status: 'waiting',
            type: 'review_request',
            bookingId: 'booking-1',
            restaurantId: 'rest-1',
            scheduledFor: '2026-03-20T14:30:00Z',
            failedReason: null,
            failedAt: null,
            attemptsMade: 0,
            booking: {
              id: 'booking-1',
              reference: 'REF001',
              customerName: 'Alex Johnson',
              customerEmail: 'alex@example.com',
              startAt: '2026-03-21T19:00:00Z',
              endAt: '2026-03-21T20:30:00Z',
              status: 'confirmed',
            },
          },
        ],
        timestamp: '2026-03-20T14:35:00Z',
      } satisfies Extract<OpsEmailQueueFeedResponse, { ok: true }>);

    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1&tab=queue'));

    renderClient(getRestaurantEmailDeliveryFeed, { getRestaurantEmailQueue });

    expect(await screen.findByRole('tab', { name: /queue/i, selected: true })).toBeInTheDocument();
    expect(screen.getByText('Scheduled email queue')).toBeInTheDocument();
    expect(screen.getByText('Total in queue')).toBeInTheDocument();
    expect(screen.getByText('Scheduled for later')).toBeInTheDocument();
    expect(screen.getByText('Ready to send')).toBeInTheDocument();
    expect(screen.getAllByText(/^Sending now$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Needs attention$/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scheduled' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ready now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sending now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Needs attention' })).toBeInTheDocument();
    expect(getRestaurantEmailQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 'rest-1',
        page: 1,
        pageSize: 25,
        status: undefined,
      }),
    );
  });

  it('shows queue loading skeletons before queue jobs resolve', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(makeSuccessResponse());

    let resolveQueue!: (value: OpsEmailQueueFeedResponse) => void;
    const queuePromise = new Promise<OpsEmailQueueFeedResponse>((resolve) => {
      resolveQueue = resolve;
    });

    const getRestaurantEmailQueue = vi
      .fn<BookingService['getRestaurantEmailQueue']>()
      .mockReturnValue(queuePromise);

    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1&tab=queue'));

    renderClient(getRestaurantEmailDeliveryFeed, { getRestaurantEmailQueue });

    expect(
      await screen.findByLabelText(/loading email queue|refreshing email queue/i),
    ).toBeInTheDocument();

    await act(async () => {
      resolveQueue({
        ok: true,
        restaurantId: 'rest-1',
        pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 0 },
        summary: { total: 0, waiting: 0, active: 0, delayed: 0, dlq: 0 },
        jobs: [],
        timestamp: '2026-03-20T14:35:00Z',
      });
      await queuePromise;
    });

    expect(await screen.findByText('No booking emails are currently queued for this restaurant.')).toBeInTheDocument();
  });

  it('does not fetch queue data until the queue tab is activated', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(makeSuccessResponse());

    let resolveQueue!: (value: OpsEmailQueueFeedResponse) => void;
    const queuePromise = new Promise<OpsEmailQueueFeedResponse>((resolve) => {
      resolveQueue = resolve;
    });

    const getRestaurantEmailQueue = vi
      .fn<BookingService['getRestaurantEmailQueue']>()
      .mockReturnValue(queuePromise);

    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1&tab=delivery-log'));

    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed, { getRestaurantEmailQueue });

    expect(await screen.findByRole('tab', { name: /delivery log/i, selected: true })).toBeInTheDocument();
    expect(getRestaurantEmailQueue).not.toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: /queue/i }));

    expect(await screen.findByLabelText(/loading email queue|refreshing email queue/i)).toBeInTheDocument();
    expect(getRestaurantEmailQueue).toHaveBeenCalledTimes(1);
    expect(getRestaurantEmailQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 'rest-1',
        page: 1,
        pageSize: 25,
        status: undefined,
      }),
    );

    await act(async () => {
      resolveQueue({
        ok: true,
        restaurantId: 'rest-1',
        pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 0 },
        summary: { total: 0, waiting: 0, active: 0, delayed: 0, dlq: 0 },
        jobs: [],
        timestamp: '2026-03-20T14:35:00Z',
      });
      await queuePromise;
    });

    expect(await screen.findByText('No queued emails right now')).toBeInTheDocument();
  });

  it('keeps the queue loading skeleton visible briefly after a fast queue response settles', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(makeSuccessResponse());

    const getRestaurantEmailQueue = vi
      .fn<BookingService['getRestaurantEmailQueue']>()
      .mockResolvedValue({
        ok: true,
        restaurantId: 'rest-1',
        pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 1 },
        summary: { total: 1, waiting: 1, active: 0, delayed: 0, dlq: 0 },
        jobs: [
          {
            id: 'job-fast',
            status: 'waiting',
            type: 'review_request',
            bookingId: 'booking-fast',
            restaurantId: 'rest-1',
            scheduledFor: '2026-03-20T14:30:00Z',
            failedReason: null,
            failedAt: null,
            attemptsMade: 0,
            booking: {
              id: 'booking-fast',
              reference: 'FAST01',
              customerName: 'Fast Queue',
              customerEmail: 'fast@example.com',
              startAt: '2026-03-21T19:00:00Z',
              endAt: '2026-03-21T20:30:00Z',
              status: 'confirmed',
            },
          },
        ],
        timestamp: '2026-03-20T14:35:00Z',
      } satisfies Extract<OpsEmailQueueFeedResponse, { ok: true }>);

    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1&tab=queue'));

    renderClient(getRestaurantEmailDeliveryFeed, { getRestaurantEmailQueue });

    await waitFor(
      () => {
        expect(screen.getByText('Fast Queue')).toBeInTheDocument();
      },
      { timeout: 1500 },
    );
    await waitFor(() => {
      expect(screen.queryByLabelText(/loading email queue|refreshing email queue/i)).not.toBeInTheDocument();
    });
  });

  it('shows a visible queue refetch indicator while stale queue rows remain rendered', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(makeSuccessResponse());

    let releaseFilteredQueue!: () => void;
    const filteredQueueGate = new Promise<void>((resolve) => {
      releaseFilteredQueue = resolve;
    });

    const getRestaurantEmailQueue = vi
      .fn<BookingService['getRestaurantEmailQueue']>()
      .mockImplementation(async ({ status }) => {
        if (status === 'waiting') {
          await filteredQueueGate;
        }

        return {
          ok: true,
          restaurantId: 'rest-1',
          pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 1 },
          summary: { total: 1, waiting: 1, active: 0, delayed: 0, dlq: 0 },
          jobs: [
            {
              id: status === 'waiting' ? 'job-filtered' : 'job-stale',
              status: 'waiting',
              type: 'review_request',
              bookingId: 'booking-queue',
              restaurantId: 'rest-1',
              scheduledFor: '2026-03-20T14:30:00Z',
              failedReason: null,
              failedAt: null,
              attemptsMade: 0,
              booking: {
                id: 'booking-queue',
                reference: 'QUEUE01',
                customerName: status === 'waiting' ? 'Filtered Queue Guest' : 'Stale Queue Guest',
                customerEmail: 'queue@example.com',
                startAt: '2026-03-21T19:00:00Z',
                endAt: '2026-03-21T20:30:00Z',
                status: 'confirmed',
              },
            },
          ],
          timestamp: '2026-03-20T14:35:00Z',
        } satisfies Extract<OpsEmailQueueFeedResponse, { ok: true }>;
      });

    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1&tab=queue'));

    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed, { getRestaurantEmailQueue });

    expect(await screen.findByText('Stale Queue Guest')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ready now' }));

    expect(await screen.findByLabelText('Refreshing email queue')).toBeInTheDocument();
    expect(screen.getByText('Stale Queue Guest')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Refreshing email queue' })).toHaveAttribute('aria-busy', 'true');

    await act(async () => {
      releaseFilteredQueue();
      await filteredQueueGate;
    });

    expect(await screen.findByText('Filtered Queue Guest')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText('Refreshing email queue')).not.toBeInTheDocument();
    });
  });

  it('forwards queueFixture=loading to queue data requests for deterministic loading validation', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(makeSuccessResponse());
    const getRestaurantEmailQueue = vi
      .fn<BookingService['getRestaurantEmailQueue']>()
      .mockResolvedValue({
        ok: true,
        restaurantId: 'rest-1',
        pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 0 },
        summary: { total: 0, waiting: 0, active: 0, delayed: 0, dlq: 0 },
        jobs: [],
        timestamp: '2026-03-20T14:35:00Z',
      });

    searchParamsMock.mockReturnValue(
      new URLSearchParams('restaurantId=rest-1&tab=queue&queueFixture=loading'),
    );

    renderClient(getRestaurantEmailDeliveryFeed, { getRestaurantEmailQueue });

    await waitFor(() => {
      expect(getRestaurantEmailQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: 'rest-1',
          fixture: 'loading',
        }),
      );
    });
  });

  it('resets queue pagination to page 1 when the queue status filter changes', async () => {
    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockResolvedValue(makeSuccessResponse());
    const getRestaurantEmailQueue = vi
      .fn<BookingService['getRestaurantEmailQueue']>()
      .mockImplementation(async ({ page, status }) => ({
        ok: true,
        restaurantId: 'rest-1',
        pageInfo: { page: page ?? 1, pageSize: 25, hasNext: (page ?? 1) < 3 && !status, total: status ? 1 : 3 },
        summary: { total: status ? 1 : 3, waiting: 1, active: 1, delayed: 1, dlq: 0 },
        jobs: [
          {
            id: status ? 'job-filtered' : `job-page-${page ?? 1}`,
            status: status ?? 'waiting',
            type: 'review_request',
            bookingId: 'booking-filtered',
            restaurantId: 'rest-1',
            scheduledFor: '2026-03-20T14:30:00Z',
            failedReason: null,
            failedAt: null,
            attemptsMade: 0,
            booking: {
              id: 'booking-filtered',
              reference: 'QUEUE01',
              customerName: 'Queue Guest',
              customerEmail: 'queue@example.com',
              startAt: '2026-03-21T19:00:00Z',
              endAt: '2026-03-21T20:30:00Z',
              status: 'confirmed',
            },
          },
        ],
        timestamp: '2026-03-20T14:35:00Z',
      } satisfies Extract<OpsEmailQueueFeedResponse, { ok: true }>));

    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1&tab=queue'));

    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed, { getRestaurantEmailQueue });

    expect(await screen.findByRole('tab', { name: /queue/i, selected: true })).toBeInTheDocument();
    await waitFor(() => {
      expect(getRestaurantEmailQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({
          restaurantId: 'rest-1',
          page: 1,
          pageSize: 25,
          status: undefined,
        }),
      );
    });

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(getRestaurantEmailQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({
          restaurantId: 'rest-1',
          page: 3,
          pageSize: 25,
          status: undefined,
        }),
      );
    });

    await user.click(screen.getByRole('button', { name: 'Ready now' }));

    await waitFor(() => {
      expect(getRestaurantEmailQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({
          restaurantId: 'rest-1',
          page: 1,
          pageSize: 25,
          status: 'waiting',
        }),
      );
    });
  });

  it('resets filters, pagination, and data scope when the restaurant changes', async () => {
    searchParamsMock.mockReturnValue(
      new URLSearchParams(
        'restaurantId=rest-1&tab=analytics&range=24h&page=2&pageSize=25&recipientEmail=ops%40example.com&status=failed',
      ),
    );

    const getRestaurantEmailDeliveryFeed = vi
      .fn<BookingService['getRestaurantEmailDeliveryFeed']>()
      .mockImplementation(async ({ restaurantId, range, page, pageSize, recipientEmail, status }) => {
        if (restaurantId === '22222222-2222-4222-8222-222222222222') {
          return makeSuccessResponse({
            restaurantId,
            range: range ?? '7d',
            pageInfo: { page: page ?? 1, pageSize: pageSize ?? 50, hasNext: false },
            attempts: [],
            summary: makeSummary(0),
          });
        }

        return makeSuccessResponse({
          restaurantId: restaurantId ?? 'rest-1',
          range: range ?? '7d',
          pageInfo: { page: page ?? 1, pageSize: pageSize ?? 50, hasNext: false },
          attempts: [],
          summary: makeSummary(status?.includes('failed') || recipientEmail ? 0 : 2),
        });
      });

    const getRestaurantEmailDeliverySummary = vi
      .fn<BookingService['getRestaurantEmailDeliverySummary']>()
      .mockImplementation(async ({ restaurantId, range, recipientEmail, status }) => ({
        ok: true,
        restaurantId: restaurantId ?? 'rest-1',
        range: range ?? '7d',
        summary: makeSummary(restaurantId === '22222222-2222-4222-8222-222222222222' && !recipientEmail && !status?.length ? 4 : 1),
      }));

    const getRestaurantEmailQueue = vi
      .fn<BookingService['getRestaurantEmailQueue']>()
      .mockImplementation(async ({ restaurantId, page, pageSize, status }) => ({
        ok: true,
        restaurantId: restaurantId ?? 'rest-1',
        pageInfo: { page: page ?? 1, pageSize: pageSize ?? 25, hasNext: false, total: status ? 1 : 2 },
        summary: { total: status ? 1 : 2, waiting: 1, active: 0, delayed: 1, dlq: 0 },
        jobs: [],
        timestamp: '2026-03-20T14:35:00Z',
      }));

    const user = userEvent.setup();
    renderClient(getRestaurantEmailDeliveryFeed, {
      getRestaurantEmailDeliverySummary,
      getRestaurantEmailQueue,
    });

    expect(await screen.findByRole('tab', { name: /analytics/i, selected: true })).toBeInTheDocument();
    await waitFor(() => {
      expect(getRestaurantEmailDeliveryFeed).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: 'rest-1',
          range: '24h',
          page: 2,
          pageSize: 25,
          recipientEmail: 'ops@example.com',
          status: ['failed'],
        }),
      );
    });
    expect(getRestaurantEmailDeliverySummary).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: 'rest-1',
        range: '24h',
        recipientEmail: 'ops@example.com',
      }),
    );

    expect(screen.getByRole('combobox', { name: /restaurant switcher/i })).toBeInTheDocument();
  });
});
