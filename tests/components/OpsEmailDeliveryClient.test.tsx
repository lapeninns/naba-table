import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

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
    getRestaurant: vi.fn().mockResolvedValue({
      id: 'rest-1',
      name: 'Test Restaurant',
      timezone: 'UTC',
    }),
    listRestaurants: vi.fn().mockResolvedValue([]),
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
) {
  return {
    getRestaurantEmailDeliveryFeed,
    getRestaurantEmailDeliverySummary,
    getRestaurantEmailQueue,
  } as unknown as BookingService;
}

function renderClient(
  getRestaurantEmailDeliveryFeed: BookingService['getRestaurantEmailDeliveryFeed'],
  options?: {
    getRestaurantEmailDeliverySummary?: BookingService['getRestaurantEmailDeliverySummary'];
    getRestaurantEmailQueue?: BookingService['getRestaurantEmailQueue'];
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
        ...makeSuccessResponse(),
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
    expect(await screen.findByRole('alert')).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: /test restaurant/i })).toBeInTheDocument();
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

    expect(await screen.findByLabelText('Loading email queue')).toBeInTheDocument();

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
});
