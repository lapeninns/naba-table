import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmailDeliveryAttemptCardDetails } from '@/components/features/email-delivery/components/OpsEmailDeliveryAttemptCardDetails';
import { buildOpsEmailDeliveryAttemptCardModel } from '@/components/features/email-delivery/opsEmailDeliveryAttemptCardDomain';

import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

const attempt: OpsEmailDeliveryAttemptDTO = {
  messageId: 'msg-details-1',
  recipientEmail: 'guest@example.com',
  bookingId: null,
  emailType: 'created',
  templateType: 'booking_confirmation',
  provider: 'resend',
  currentStatus: 'failed',
  currentOccurredAt: '2026-03-20T15:00:00Z',
  events: [
    {
      id: 'evt-1',
      bookingId: null,
      restaurantId: 'rest-1',
      emailType: 'created',
      templateType: 'booking_confirmation',
      recipientEmail: 'guest@example.com',
      messageId: 'msg-details-1',
      status: 'sent',
      provider: 'resend',
      occurredAt: '2026-03-20T14:00:00Z',
      error: null,
      metadata: { subject: 'Your booking' },
    },
    {
      id: 'evt-2',
      bookingId: null,
      restaurantId: 'rest-1',
      emailType: 'created',
      templateType: 'booking_confirmation',
      recipientEmail: 'guest@example.com',
      messageId: 'msg-details-1',
      status: 'failed',
      provider: 'resend',
      occurredAt: '2026-03-20T15:00:00Z',
      error: 'Mailbox unavailable',
      metadata: null,
    },
  ],
  booking: null,
};

function buildModel() {
  return buildOpsEmailDeliveryAttemptCardModel({
    attempt,
    restaurantId: 'rest-1',
    timezone: 'UTC',
  });
}

describe('OpsEmailDeliveryAttemptCardDetails', () => {
  it('@smoke renders the message id with a copy control', () => {
    render(<OpsEmailDeliveryAttemptCardDetails model={buildModel()} />);

    expect(screen.getByText('Message id')).toBeInTheDocument();
    expect(screen.getByText('msg-details-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy message id' })).toBeInTheDocument();
  });

  it('@smoke renders one timeline row per event with pinned timezone-stable timestamps and errors', () => {
    render(<OpsEmailDeliveryAttemptCardDetails model={buildModel()} />);

    // Luxon formats with the explicit UTC zone, independent of host TZ.
    expect(screen.getByText('Fri, Mar 20 · 14:00')).toBeInTheDocument();
    expect(screen.getByText('Fri, Mar 20 · 15:00')).toBeInTheDocument();
    expect(screen.getByText('Mailbox unavailable')).toBeInTheDocument();
  });
});
