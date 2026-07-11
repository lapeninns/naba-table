import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsEmailDeliveryAttemptCard } from '@/components/features/email-delivery/components/OpsEmailDeliveryAttemptCard';

import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

const attempt: OpsEmailDeliveryAttemptDTO = {
  messageId: 'msg-card-1',
  recipientEmail: 'failed@example.com',
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
      recipientEmail: 'failed@example.com',
      messageId: 'msg-card-1',
      status: 'failed',
      provider: 'resend',
      occurredAt: '2026-03-20T15:00:00Z',
      error: 'Mailbox unavailable',
      metadata: { subject: 'Your booking' },
    },
  ],
  booking: null,
};

describe('OpsEmailDeliveryAttemptCard', () => {
  it('@contract hides the retry action unless the attempt is retryable and a handler is provided', () => {
    render(<OpsEmailDeliveryAttemptCard attempt={attempt} timezone="UTC" restaurantId="rest-1" />);

    expect(
      screen.queryByRole('button', { name: /retry email for failed@example.com/i }),
    ).not.toBeInTheDocument();
  });

  it('@contract @a11y fires onRetry from the recipient-labeled retry action', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <OpsEmailDeliveryAttemptCard
        attempt={attempt}
        timezone="UTC"
        restaurantId="rest-1"
        canRetry
        onRetry={onRetry}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Retry email for failed@example.com' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('@contract disables the retry action while a retry is in flight', () => {
    render(
      <OpsEmailDeliveryAttemptCard
        attempt={attempt}
        timezone="UTC"
        restaurantId="rest-1"
        canRetry
        isRetrying
        onRetry={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /retry email for failed@example.com/i }),
    ).toBeDisabled();
  });

  it('@contract expands the collapsible details with the event timeline on toggle', async () => {
    const user = userEvent.setup();
    render(<OpsEmailDeliveryAttemptCard attempt={attempt} timezone="UTC" restaurantId="rest-1" />);

    expect(screen.queryByText('Message id')).not.toBeInTheDocument();
    // Closed: the timestamp renders once, in the card header.
    expect(screen.getAllByText('Fri, Mar 20 · 15:00')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Toggle attempt details' }));

    expect(screen.getByText('Message id')).toBeInTheDocument();
    expect(screen.getByText('msg-card-1')).toBeInTheDocument();
    // Open: the event timeline adds a second timestamp row alongside the header's.
    expect(screen.getAllByText('Fri, Mar 20 · 15:00')).toHaveLength(2);
  });
});
