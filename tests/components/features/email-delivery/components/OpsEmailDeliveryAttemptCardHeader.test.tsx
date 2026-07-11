import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliveryAttemptCardHeader } from '@/components/features/email-delivery/components/OpsEmailDeliveryAttemptCardHeader';
import { buildOpsEmailDeliveryAttemptCardModel } from '@/components/features/email-delivery/opsEmailDeliveryAttemptCardDomain';
import { Collapsible } from '@/components/ui/collapsible';

import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

function makeAttempt(overrides: Partial<OpsEmailDeliveryAttemptDTO> = {}): OpsEmailDeliveryAttemptDTO {
  return {
    messageId: 'msg-header-1',
    recipientEmail: 'guest@example.com',
    bookingId: 'booking-1',
    emailType: 'created',
    templateType: 'booking_confirmation',
    provider: 'resend',
    currentStatus: 'delivered',
    currentOccurredAt: '2026-03-20T15:00:00Z',
    events: [
      {
        id: 'evt-1',
        bookingId: 'booking-1',
        restaurantId: 'rest-1',
        emailType: 'created',
        templateType: 'booking_confirmation',
        recipientEmail: 'guest@example.com',
        messageId: 'msg-header-1',
        status: 'delivered',
        provider: 'resend',
        occurredAt: '2026-03-20T15:00:00Z',
        error: null,
        metadata: { subject: 'Your booking is confirmed' },
      },
    ],
    booking: {
      id: 'booking-1',
      reference: 'REF001',
      bookingDate: '2026-03-21',
      startTime: '19:00',
      endTime: '20:30',
      customerName: 'Alex Johnson',
      partySize: 4,
    },
    ...overrides,
  };
}

function renderHeader(attempt: OpsEmailDeliveryAttemptDTO) {
  const model = buildOpsEmailDeliveryAttemptCardModel({
    attempt,
    restaurantId: 'rest-1',
    timezone: 'UTC',
  });
  return render(
    <Collapsible>
      <OpsEmailDeliveryAttemptCardHeader model={model} />
    </Collapsible>,
  );
}

describe('OpsEmailDeliveryAttemptCardHeader', () => {
  it('@smoke renders subject, recipient, booking context, and pinned booking start time', () => {
    renderHeader(makeAttempt());

    expect(screen.getByText('Your booking is confirmed')).toBeInTheDocument();
    expect(screen.getByText('guest@example.com')).toBeInTheDocument();
    expect(screen.getByText('REF001 · Alex Johnson')).toBeInTheDocument();
    // Booking start rendered in the explicit UTC zone: 2026-03-21 is a Saturday.
    expect(screen.getByText('Sat, Mar 21 · 19:00')).toBeInTheDocument();
  });

  it('@smoke @a11y exposes the open-booking link and labeled toggle/copy controls', () => {
    renderHeader(makeAttempt());

    expect(screen.getByRole('link', { name: 'Open booking' })).toHaveAttribute(
      'href',
      '/app/bookings?restaurantId=rest-1&focus=booking-1',
    );
    expect(screen.getByRole('button', { name: 'Copy message id' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle attempt details' })).toBeInTheDocument();
  });

  it('@smoke omits the booking affordances and surfaces the current error for failed attempts without bookings', () => {
    renderHeader(
      makeAttempt({
        bookingId: null,
        booking: null,
        currentStatus: 'failed',
        events: [
          {
            id: 'evt-err',
            bookingId: null,
            restaurantId: 'rest-1',
            emailType: 'created',
            templateType: 'booking_confirmation',
            recipientEmail: 'guest@example.com',
            messageId: 'msg-header-1',
            status: 'failed',
            provider: 'resend',
            occurredAt: '2026-03-20T15:00:00Z',
            error: 'SMTP 550 rejected',
            metadata: null,
          },
        ],
      }),
    );

    expect(screen.queryByRole('link', { name: 'Open booking' })).not.toBeInTheDocument();
    expect(screen.getByText('SMTP 550 rejected')).toBeInTheDocument();
  });
});
