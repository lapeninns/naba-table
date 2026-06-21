import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpsEmailDeliveryTable } from '@/components/features/email-delivery/components/OpsEmailDeliveryTable';
import { buildOpsEmailDeliveryTableRows } from '@/components/features/email-delivery/opsEmailDeliverySelectors';

import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

function makeAttempt(
  overrides: Partial<OpsEmailDeliveryAttemptDTO> = {},
): OpsEmailDeliveryAttemptDTO {
  return {
    messageId: 'msg-test-1',
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
        messageId: 'msg-test-1',
        status: 'sent',
        provider: 'resend',
        occurredAt: '2026-03-20T14:28:00Z',
        error: null,
        metadata: null,
      },
      {
        id: 'evt-2',
        bookingId: 'booking-1',
        restaurantId: 'rest-1',
        emailType: 'created',
        templateType: 'booking_confirmation',
        recipientEmail: 'alex@example.com',
        messageId: 'msg-test-1',
        status: 'delivered',
        provider: 'resend',
        occurredAt: '2026-03-20T14:30:00Z',
        error: null,
        metadata: null,
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
    ...overrides,
  };
}

const defaultAttempts: OpsEmailDeliveryAttemptDTO[] = [
  makeAttempt(),
  makeAttempt({
    messageId: 'msg-test-2',
    recipientEmail: 'sam@example.com',
    currentStatus: 'failed',
    currentOccurredAt: '2026-03-20T15:00:00Z',
    emailType: 'review_request',
    templateType: 'review_request',
    events: [
      {
        id: 'evt-3',
        bookingId: 'booking-2',
        restaurantId: 'rest-1',
        emailType: 'review_request',
        templateType: 'review_request',
        recipientEmail: 'sam@example.com',
        messageId: 'msg-test-2',
        status: 'sent',
        provider: 'resend',
        occurredAt: '2026-03-20T14:58:00Z',
        error: null,
        metadata: null,
      },
      {
        id: 'evt-4',
        bookingId: 'booking-2',
        restaurantId: 'rest-1',
        emailType: 'review_request',
        templateType: 'review_request',
        recipientEmail: 'sam@example.com',
        messageId: 'msg-test-2',
        status: 'failed',
        provider: 'resend',
        occurredAt: '2026-03-20T15:00:00Z',
        error: 'Mailbox unavailable',
        metadata: null,
      },
    ],
    booking: {
      id: 'booking-2',
      reference: 'REF002',
      bookingDate: '2026-03-20',
      startTime: '20:00',
      endTime: '21:30',
      customerName: 'Sam Patel',
      partySize: 2,
    },
  }),
  makeAttempt({
    messageId: 'msg-test-3',
    recipientEmail: 'jane@example.com',
    currentStatus: 'delivery_delayed',
    currentOccurredAt: '2026-03-20T13:00:00Z',
    emailType: 'cancelled',
    templateType: 'booking_cancellation',
    events: [
      {
        id: 'evt-5',
        bookingId: 'booking-3',
        restaurantId: 'rest-1',
        emailType: 'cancelled',
        templateType: 'booking_cancellation',
        recipientEmail: 'jane@example.com',
        messageId: 'msg-test-3',
        status: 'delivery_delayed',
        provider: 'resend',
        occurredAt: '2026-03-20T13:00:00Z',
        error: null,
        metadata: null,
      },
    ],
    booking: {
      id: 'booking-3',
      reference: 'REF003',
      bookingDate: '2026-03-20',
      startTime: '18:00',
      endTime: '19:30',
      customerName: 'Jane Doe',
      partySize: 3,
    },
  }),
];

function buildRows(attempts: OpsEmailDeliveryAttemptDTO[] = defaultAttempts, timezone = 'UTC') {
  return buildOpsEmailDeliveryTableRows({ attempts, timezone });
}

function getRecipientOrder() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => {
      const emailCell = within(row).queryByText(/@example\.com$/);
      return emailCell?.textContent ?? '';
    })
    .filter(Boolean);
}

describe('OpsEmailDeliveryTable', () => {
  beforeEach(() => {
    // vitest.config sets mockReset:true, which wipes the global matchMedia mock
    // implementation before each test (so it returns undefined). The table reads
    // useIsMobileState(1024) and now holds a skeleton until the breakpoint is
    // measured, so restore a working matchMedia and a desktop-width viewport
    // (>= the lg breakpoint) for the effect to resolve to the table variant.
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1280,
    });
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

  it('renders table with correct column headers', () => {
    render(
      <OpsEmailDeliveryTable
        rows={buildRows(defaultAttempts, 'Europe/London')}
        timezone="Europe/London"
        restaurantId="rest-1"
        isLoading={false}
      />,
    );

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Subject')).toBeInTheDocument();
    expect(screen.getByText('Recipient')).toBeInTheDocument();
    expect(screen.getByText('Email Type')).toBeInTheDocument();
    expect(screen.getByText('Booking Ref')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Sent At')).toBeInTheDocument();
  });

  it('renders data rows with correct content', () => {
    render(
      <OpsEmailDeliveryTable
        rows={buildRows(defaultAttempts)}
        timezone="UTC"
        restaurantId="rest-1"
        isLoading={false}
      />,
    );

    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('sam@example.com')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('REF001')).toBeInTheDocument();
    expect(screen.getByText('REF002')).toBeInTheDocument();
    expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
    expect(screen.getByText('Sam Patel')).toBeInTheDocument();
  });

  it('shows status badges with correct labels', () => {
    render(
      <OpsEmailDeliveryTable
        rows={buildRows(defaultAttempts)}
        timezone="UTC"
        restaurantId="rest-1"
        isLoading={false}
      />,
    );

    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Delayed')).toBeInTheDocument();
  });

  it('sorts by Sent At on header click', async () => {
    const user = userEvent.setup();

    render(
      <OpsEmailDeliveryTable
        rows={buildRows(defaultAttempts)}
        timezone="UTC"
        restaurantId="rest-1"
        isLoading={false}
      />,
    );

    // Default sort is desc — first row should be the most recent (sam@example.com at 15:00)
    const rows = screen.getAllByRole('row');
    // Row 0 is header, row 1 is first data row
    expect(within(rows[1]!).getByText('sam@example.com')).toBeInTheDocument();

    // Click Sent At to toggle to ascending
    await user.click(screen.getByText('Sent At'));

    const rowsAfterSort = screen.getAllByRole('row');
    // After asc sort, first data row should be the oldest (jane@example.com at 13:00)
    expect(within(rowsAfterSort[1]!).getByText('jane@example.com')).toBeInTheDocument();
  });

  it('sorts by Status on header click using displayed status ordering ascending and descending', async () => {
    const user = userEvent.setup();

    render(
      <OpsEmailDeliveryTable
        rows={buildRows(defaultAttempts)}
        timezone="UTC"
        restaurantId="rest-1"
        isLoading={false}
      />,
    );

    await user.click(screen.getByText('Status'));
    expect(getRecipientOrder()).toEqual([
      'jane@example.com',
      'alex@example.com',
      'sam@example.com',
    ]);

    await user.click(screen.getByText('Status'));
    expect(getRecipientOrder()).toEqual([
      'sam@example.com',
      'alex@example.com',
      'jane@example.com',
    ]);
  });

  it('expands a row on click to show event timeline', async () => {
    const user = userEvent.setup();

    render(
      <OpsEmailDeliveryTable
        rows={buildRows(defaultAttempts)}
        timezone="UTC"
        restaurantId="rest-1"
        isLoading={false}
      />,
    );

    // Event timeline should not be visible initially
    expect(screen.queryByText('Event Timeline')).not.toBeInTheDocument();

    // Default sort is desc by Sent At, so first data row is msg-test-2 (sam@example.com, 15:00)
    const rows = screen.getAllByRole('row');
    await user.click(rows[1]!);

    // Now the event timeline and message ID should appear
    expect(screen.getByText('msg-test-2')).toBeInTheDocument();
    expect(screen.getByText('Event Timeline')).toBeInTheDocument();
  });

  it('shows error message in expanded row when present', async () => {
    const user = userEvent.setup();

    render(
      <OpsEmailDeliveryTable
        rows={buildRows(defaultAttempts)}
        timezone="UTC"
        restaurantId="rest-1"
        isLoading={false}
      />,
    );

    // Default sort desc — sam@example.com (failed with error) is first row
    const rows = screen.getAllByRole('row');
    await user.click(rows[1]!);

    // Error appears in both the error section and the event timeline
    const errorTexts = screen.getAllByText('Mailbox unavailable');
    expect(errorTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('shows an open booking link and copies the message id from expanded rows', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <OpsEmailDeliveryTable
        rows={buildRows(defaultAttempts)}
        timezone="UTC"
        restaurantId="rest-1"
        isLoading={false}
      />,
    );

    const rows = screen.getAllByRole('row');
    await user.click(rows[1]!);

    const openBookingLink = screen.getByRole('link', { name: /open booking/i });
    expect(openBookingLink).toHaveAttribute(
      'href',
      '/app/bookings?restaurantId=rest-1&focus=booking-1',
    );

    await user.click(screen.getByRole('button', { name: /copy message id/i }));

    expect(writeText).toHaveBeenCalledWith('msg-test-2');
    expect(screen.getByRole('button', { name: /message id copied/i })).toBeInTheDocument();
  });

  it('collapses expanded row on second click', async () => {
    const user = userEvent.setup();

    render(
      <OpsEmailDeliveryTable
        rows={buildRows(defaultAttempts)}
        timezone="UTC"
        restaurantId="rest-1"
        isLoading={false}
      />,
    );

    const rows = screen.getAllByRole('row');
    // Expand
    await user.click(rows[1]!);
    expect(screen.getByText('Event Timeline')).toBeInTheDocument();

    // Collapse by clicking same row again
    await user.click(rows[1]!);
    expect(screen.queryByText('Event Timeline')).not.toBeInTheDocument();
  });

  it('only one row expanded at a time', async () => {
    const user = userEvent.setup();

    render(
      <OpsEmailDeliveryTable
        rows={buildRows(defaultAttempts)}
        timezone="UTC"
        restaurantId="rest-1"
        isLoading={false}
      />,
    );

    const rows = screen.getAllByRole('row');
    // Expand first data row
    await user.click(rows[1]!);
    expect(screen.getByText('Event Timeline')).toBeInTheDocument();

    // Now click another row — should collapse the first and expand the second
    await user.click(rows[2]!);
    // Only one expanded detail section at a time
    const timelines = screen.getAllByText('Event Timeline');
    expect(timelines).toHaveLength(1);
  });

  it('renders an empty table shell when no results', () => {
    render(
      <OpsEmailDeliveryTable rows={[]} timezone="UTC" restaurantId="rest-1" isLoading={false} />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.queryByText(/no email deliveries found/i)).not.toBeInTheDocument();
  });

  it('shows loading skeleton while data fetches', () => {
    render(
      <OpsEmailDeliveryTable rows={[]} timezone="UTC" restaurantId="rest-1" isLoading={true} />,
    );

    expect(screen.getByLabelText('Loading email delivery attempts')).toBeInTheDocument();
  });

  it('shows retry buttons only for failed and bounced rows', () => {
    render(
      <OpsEmailDeliveryTable
        rows={buildRows([
          ...defaultAttempts,
          makeAttempt({
            messageId: 'msg-test-4',
            recipientEmail: 'bounce@example.com',
            currentStatus: 'bounced',
            currentOccurredAt: '2026-03-20T16:00:00Z',
          }),
        ])}
        timezone="UTC"
        restaurantId="rest-1"
        isLoading={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: /retry email for sam@example.com/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /retry email for bounce@example.com/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /retry email for alex@example.com/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /retry email for jane@example.com/i }),
    ).not.toBeInTheDocument();
  });

  it('opens a retry confirmation dialog with delivery details', async () => {
    const user = userEvent.setup();

    render(
      <OpsEmailDeliveryTable
        rows={buildRows(defaultAttempts)}
        timezone="UTC"
        restaurantId="rest-1"
        isLoading={false}
        pendingRetryRow={buildRows(defaultAttempts)[1]}
        isRetryDialogOpen
      />,
    );

    expect(screen.getByText('Retry email delivery?')).toBeInTheDocument();
    expect(screen.getAllByText('sam@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('review_request').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Warning: retrying will create a new delivery attempt/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm retry/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
  });
});
