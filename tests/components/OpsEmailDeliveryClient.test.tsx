import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpsEmailDeliveryClient } from '@/components/features/email-delivery/OpsEmailDeliveryClient';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';
import { OpsUnsavedChangesProvider } from '@/contexts/ops-unsaved-changes';
import { HttpError } from '@/lib/http/errors';
import { createMutationFeedbackCache } from '@/lib/query/client';
import { EmailDeliveryTransportProvider } from '@src/hooks/ops/emailDeliveryTransport';

import type { BookingService } from '@/services/ops/bookings';
import type { EmailDeliveryTransport } from '@/services/ops/email-delivery';
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
  transport?: Partial<EmailDeliveryTransport>;
}) {
  const queryClient = new QueryClient({
    mutationCache: createMutationFeedbackCache({
      success: (message) => toastSuccessMock(message),
      error: (message) => toastErrorMock(message),
    }),
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
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
  const transport: EmailDeliveryTransport = {
    retryEmailDelivery: vi.fn<EmailDeliveryTransport['retryEmailDelivery']>().mockResolvedValue({
      ok: true,
      status: 'sent',
      retryAttempt: 1,
      deliveryLogEntry: {},
    }),
    cancelEmailQueueJob: vi.fn<EmailDeliveryTransport['cancelEmailQueueJob']>(),
    requeueEmailQueueJob: vi.fn<EmailDeliveryTransport['requeueEmailQueueJob']>(),
    ...options?.transport,
  };

  render(
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider
        factories={{
          bookingService: () =>
            ({
              getRestaurantEmailDeliveryFeed,
              getRestaurantEmailDeliverySummary,
              getRestaurantEmailQueue,
            }) as unknown as BookingService,
          restaurantService: () => createRestaurantService() as never,
        }}
      >
        <OpsSessionProvider user={user} memberships={memberships} initialRestaurantId="rest-1">
          <OpsUnsavedChangesProvider>
            <EmailDeliveryTransportProvider transport={transport}>
              <OpsEmailDeliveryClient initialRestaurantId="rest-1" initialRange="7d" />
            </EmailDeliveryTransportProvider>
          </OpsUnsavedChangesProvider>
        </OpsSessionProvider>
      </OpsServicesProvider>
    </QueryClientProvider>,
  );

  return {
    getRestaurantEmailDeliveryFeed,
    getRestaurantEmailDeliverySummary,
    getRestaurantEmailQueue,
    transport,
    queryClient,
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

});

function installMatchMedia() {
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
}

function failedAttemptFeed() {
  return vi.fn<BookingService['getRestaurantEmailDeliveryFeed']>().mockResolvedValue(
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
}

function queueFeed(status: 'delayed' | 'dlq') {
  return vi.fn<BookingService['getRestaurantEmailQueue']>().mockResolvedValue({
    ok: true,
    restaurantId: 'rest-1',
    pageInfo: { page: 1, pageSize: 25, hasNext: false, total: 1 },
    summary: { total: 1, waiting: 0, active: 0, delayed: 1, dlq: 0 },
    jobs: [
      {
        id: 'email__reminder_24h__booking-1',
        status,
        type: 'reminder_24h',
        bookingId: 'booking-1',
        restaurantId: 'rest-1',
        scheduledFor: '2099-01-01T10:00:00.000Z',
        failedReason: null,
        failedAt: null,
        attemptsMade: 0,
        booking: {
          id: 'booking-1',
          reference: 'REF1',
          customerName: 'Guest',
          customerEmail: 'guest@example.com',
          startAt: null,
          endAt: null,
        },
      },
    ],
    timestamp: new Date().toISOString(),
  } as never);
}

describe('OpsEmailDeliveryClient mutations', () => {
  beforeEach(() => {
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    pathnameMock.mockReturnValue('/app/email-delivery');
    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1&tab=delivery-log'));
    installMatchMedia();
  });

  it('resends a failed row, reports "Sent" and refreshes only the delivery data', async () => {
    const user = userEvent.setup();
    const getRestaurantEmailDeliveryFeed = failedAttemptFeed();
    const { transport, queryClient } = renderClient({ getRestaurantEmailDeliveryFeed });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.click(
      await screen.findByRole('button', { name: /retry email for failed@example.com/i }),
    );
    await user.click(screen.getByRole('button', { name: /confirm retry/i }));

    await waitFor(() => {
      expect(transport.retryEmailDelivery).toHaveBeenCalledWith({
        restaurantId: 'rest-1',
        deliveryLogId: '11111111-1111-4111-8111-111111111111',
        simulateError: undefined,
      });
    });
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith(
        'Sent: the email was resent to failed@example.com.',
      ),
    );
    expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['ops', 'email-delivery', 'rest-1'],
      ['ops', 'email-delivery-summary', 'rest-1'],
      ['ops', 'bookings', 'booking-failed', 'email-delivery'],
    ]);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('shows safe copy when the resend is refused, never the raw error text', async () => {
    const user = userEvent.setup();
    renderClient({
      getRestaurantEmailDeliveryFeed: failedAttemptFeed(),
      transport: {
        retryEmailDelivery: vi.fn().mockRejectedValue(
          new HttpError({
            status: 409,
            code: 'RETRY_IN_PROGRESS',
            message: 'This email is already being resent.',
          }),
        ),
      },
    });

    await user.click(
      await screen.findByRole('button', { name: /retry email for failed@example.com/i }),
    );
    await user.click(screen.getByRole('button', { name: /confirm retry/i }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        'This email is already being resent. Refresh in a moment to see the result.',
      ),
    );
  });

  it('never shows 5xx server text for a failed resend', async () => {
    const user = userEvent.setup();
    renderClient({
      getRestaurantEmailDeliveryFeed: failedAttemptFeed(),
      transport: {
        retryEmailDelivery: vi
          .fn()
          .mockRejectedValue(new HttpError({ status: 500, message: 'SECRET_DB_DETAIL' })),
      },
    });

    await user.click(
      await screen.findByRole('button', { name: /retry email for failed@example.com/i }),
    );
    await user.click(screen.getByRole('button', { name: /confirm retry/i }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(toastErrorMock.mock.calls)).not.toContain('SECRET_DB_DETAIL');
  });

  it('asks for confirmation before cancelling a scheduled email', async () => {
    const user = userEvent.setup();
    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1&tab=queue'));
    const cancelEmailQueueJob = vi.fn<EmailDeliveryTransport['cancelEmailQueueJob']>().mockResolvedValue({
      ok: true,
      jobId: 'email__reminder_24h__booking-1',
      action: 'cancelled',
    });
    renderClient({ getRestaurantEmailQueue: queueFeed('delayed'), transport: { cancelEmailQueueJob } });

    await user.click(screen.getByRole('tab', { name: /queue/i }));
    const [cancelButton] = await screen.findAllByRole('button', { name: 'Cancel' });
    await user.click(cancelButton!);

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('guest@example.com');
    expect(cancelEmailQueueJob).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Keep scheduled' }));
    expect(cancelEmailQueueJob).not.toHaveBeenCalled();

    await user.click((await screen.findAllByRole('button', { name: 'Cancel' }))[0]!);
    await user.click(await screen.findByRole('button', { name: 'Cancel email' }));

    await waitFor(() =>
      expect(cancelEmailQueueJob).toHaveBeenCalledWith({
        restaurantId: 'rest-1',
        jobId: 'email__reminder_24h__booking-1',
      }),
    );
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith('Scheduled email cancelled.'));
  });

  it('explains a cancel refused because the email is already sending', async () => {
    const user = userEvent.setup();
    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1&tab=queue'));
    renderClient({
      getRestaurantEmailQueue: queueFeed('delayed'),
      transport: {
        cancelEmailQueueJob: vi.fn().mockRejectedValue(
          new HttpError({ status: 409, code: 'JOB_IN_PROGRESS', message: 'x' }),
        ),
      },
    });

    await user.click(screen.getByRole('tab', { name: /queue/i }));
    await user.click((await screen.findAllByRole('button', { name: 'Cancel' }))[0]!);
    await user.click(await screen.findByRole('button', { name: 'Cancel email' }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        'This email is being sent right now, so it can no longer be cancelled.',
      ),
    );
  });

  it('requeues a failed job without a dialog', async () => {
    const user = userEvent.setup();
    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1&tab=queue'));
    const requeueEmailQueueJob = vi.fn<EmailDeliveryTransport['requeueEmailQueueJob']>().mockResolvedValue({
      ok: true,
      jobId: 'email__reminder_24h__booking-1',
      action: 'requeued',
    });
    renderClient({ getRestaurantEmailQueue: queueFeed('dlq'), transport: { requeueEmailQueueJob } });

    await user.click(screen.getByRole('tab', { name: /queue/i }));
    await user.click((await screen.findAllByRole('button', { name: 'Requeue' }))[0]!);

    await waitFor(() =>
      expect(requeueEmailQueueJob).toHaveBeenCalledWith({
        restaurantId: 'rest-1',
        jobId: 'email__reminder_24h__booking-1',
      }),
    );
    await waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith('Email requeued. It sends on the next queue run.'),
    );
  });
});

describe('OpsEmailDeliveryClient (legacy retry contract)', () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue('/app/email-delivery');
    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1&tab=delivery-log'));
    installMatchMedia();
  });

  it('retries a failed row with restaurantId and deliveryLogId', async () => {
    const user = userEvent.setup();
    const retryEmailDelivery = vi.fn<EmailDeliveryTransport['retryEmailDelivery']>().mockResolvedValue({
      ok: true,
      status: 'sent',
      retryAttempt: 1,
      deliveryLogEntry: {},
    });

    renderClient({
      transport: { retryEmailDelivery },
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
      expect(retryEmailDelivery).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: 'rest-1',
          deliveryLogId: '11111111-1111-4111-8111-111111111111',
        }),
      );
    });
    expect(toastSuccessMock).not.toHaveBeenCalledWith('Retry queued', expect.anything());
  });
});
