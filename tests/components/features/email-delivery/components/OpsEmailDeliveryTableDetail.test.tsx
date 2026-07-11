import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpsEmailDeliveryTableDetail } from '@/components/features/email-delivery/components/OpsEmailDeliveryTableDetail';

import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

function makeAttempt(overrides: Partial<OpsEmailDeliveryAttemptDTO> = {}): OpsEmailDeliveryAttemptDTO {
  return {
    messageId: 'msg-detail-1',
    recipientEmail: 'guest@example.com',
    bookingId: 'booking-9',
    emailType: 'created',
    templateType: 'booking_confirmation',
    provider: 'resend',
    currentStatus: 'failed',
    currentOccurredAt: '2026-03-20T15:00:00Z',
    events: [
      {
        id: 'evt-1',
        bookingId: 'booking-9',
        restaurantId: 'rest-1',
        emailType: 'created',
        templateType: 'booking_confirmation',
        recipientEmail: 'guest@example.com',
        messageId: 'msg-detail-1',
        status: 'sent',
        provider: 'resend',
        occurredAt: '2026-03-20T14:00:00Z',
        error: null,
        metadata: null,
      },
      {
        id: 'evt-2',
        bookingId: 'booking-9',
        restaurantId: 'rest-1',
        emailType: 'created',
        templateType: 'booking_confirmation',
        recipientEmail: 'guest@example.com',
        messageId: 'msg-detail-1',
        status: 'failed',
        provider: 'resend',
        occurredAt: '2026-03-20T15:00:00Z',
        error: 'Mailbox unavailable',
        metadata: null,
      },
    ],
    booking: null,
    ...overrides,
  };
}

describe('OpsEmailDeliveryTableDetail', () => {
  it('@contract renders message id, error callout, and the pinned-timezone event timeline', () => {
    render(
      <OpsEmailDeliveryTableDetail attempt={makeAttempt()} timezone="UTC" restaurantId="rest-1" />,
    );

    expect(screen.getByText('msg-detail-1')).toBeInTheDocument();
    expect(screen.getByText('Event Timeline')).toBeInTheDocument();
    expect(screen.getByText('Fri, Mar 20 · 14:00')).toBeInTheDocument();
    expect(screen.getByText('Fri, Mar 20 · 15:00')).toBeInTheDocument();
    // The first event with an error feeds the error callout; it also appears on its timeline row.
    expect(screen.getAllByText('Mailbox unavailable').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('@contract links to the focused booking only when a booking id exists', () => {
    const { rerender } = render(
      <OpsEmailDeliveryTableDetail attempt={makeAttempt()} timezone="UTC" restaurantId="rest-1" />,
    );

    expect(screen.getByRole('link', { name: 'Open booking' })).toHaveAttribute(
      'href',
      '/app/bookings?restaurantId=rest-1&focus=booking-9',
    );

    rerender(
      <OpsEmailDeliveryTableDetail
        attempt={makeAttempt({ bookingId: null })}
        timezone="UTC"
        restaurantId="rest-1"
      />,
    );

    expect(screen.queryByRole('link', { name: 'Open booking' })).not.toBeInTheDocument();
  });

  it('@contract copies the message id to the clipboard and confirms via the button label', async () => {
    const user = userEvent.setup();
    // Define after setup(): userEvent installs its own clipboard stub there,
    // and the spy must win so the component's writeText call is observable.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <OpsEmailDeliveryTableDetail attempt={makeAttempt()} timezone="UTC" restaurantId="rest-1" />,
    );

    await user.click(screen.getByRole('button', { name: 'Copy message id' }));

    expect(writeText).toHaveBeenCalledWith('msg-detail-1');
    expect(await screen.findByRole('button', { name: 'Message ID copied' })).toBeInTheDocument();
  });
});
