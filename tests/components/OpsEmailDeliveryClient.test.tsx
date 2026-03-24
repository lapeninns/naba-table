import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { OpsEmailDeliveryClient } from '@/components/features/email-delivery/OpsEmailDeliveryClient';
import { OpsSidebarLayout } from '@/components/features/ops-shell/OpsSidebarLayout';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';

import type { BookingService } from '@/services/ops/bookings';
import type { OpsEmailDeliveryFeedResponse, OpsEmailDeliverySummary } from '@/types/emailDelivery';
import type { OpsMembership, OpsUser } from '@/types/ops';

const replaceMock = vi.fn();
const pathnameMock = vi.fn();
const searchParamsMock = vi.fn();

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    usePathname: () => pathnameMock(),
    useRouter: () => ({ replace: replaceMock }),
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
    expect(replaceMock).toHaveBeenCalledWith(
      '/app/email-delivery?restaurantId=rest-1&tab=queue&range=24h&page=2',
      { scroll: false },
    );
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

    searchParamsMock.mockReturnValue(
      new URLSearchParams('restaurantId=rest-1&tab=analytics&range=30d&page=2&pageSize=25'),
    );

    renderClient(getRestaurantEmailDeliveryFeed);

    expect(await screen.findByRole('tab', { name: /analytics/i, selected: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Email delivery metrics')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalledWith(
      expect.stringContaining('_rsc'),
      expect.anything(),
    );
    expect(replaceMock).not.toHaveBeenCalledWith(
      '/app/email-delivery?restaurantId=rest-1&range=30d&page=2&pageSize=25',
      { scroll: false },
    );
  });
});
