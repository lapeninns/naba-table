import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PINNED_TIMEZONE } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';
import { describe, expect, it, vi } from 'vitest';

const { useEmailLogMock } = vi.hoisted(() => ({
  useEmailLogMock: vi.fn(),
}));

vi.mock('@/hooks/ops/useOpsBookingEmailDeliveryLog', () => ({
  useOpsBookingEmailDeliveryLog: useEmailLogMock,
}));

import { EmailDeliveryPanel } from '@/components/features/dashboard/booking-details/components/EmailDeliveryPanel';

import type { EmailDeliveryEventDTO } from '@/types/emailDelivery';

function makeEvent(overrides: Partial<EmailDeliveryEventDTO> = {}): EmailDeliveryEventDTO {
  return {
    id: 'event-1',
    bookingId: 'booking-1',
    restaurantId: 'restaurant-1',
    emailType: 'confirmation',
    templateType: 'booking_confirmation',
    recipientEmail: 'alex@example.com',
    messageId: 'msg-1',
    status: 'delivered',
    provider: null,
    occurredAt: '2026-06-15T12:00:00.000Z',
    error: null,
    metadata: null,
    ...overrides,
  };
}

function mockQuery(overrides: Record<string, unknown> = {}) {
  useEmailLogMock.mockReturnValue({
    isLoading: false,
    error: null,
    events: [],
    unavailable: false,
    apiError: null,
    ...overrides,
  });
}

function renderPanel() {
  return render(<EmailDeliveryPanel bookingId="booking-1" timezone={PINNED_TIMEZONE} />);
}

describe('EmailDeliveryPanel', () => {
  it('@contract renders skeletons while loading', () => {
    mockQuery({ isLoading: true });

    const { container } = renderPanel();

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('@contract explains when tracking is unavailable in this environment', () => {
    mockQuery({ unavailable: true });

    renderPanel();

    expect(screen.getByText('Tracking unavailable')).toBeInTheDocument();
  });

  it('@contract surfaces API errors', () => {
    mockQuery({ apiError: { error: 'Log endpoint returned 500' } });

    renderPanel();

    expect(screen.getByText('Unable to load events')).toBeInTheDocument();
    expect(screen.getByText('Log endpoint returned 500')).toBeInTheDocument();
  });

  it('@contract surfaces unexpected errors', () => {
    mockQuery({ error: new Error('boom') });

    renderPanel();

    expect(screen.getByText('Unexpected delivery error')).toBeInTheDocument();
    expect(screen.queryByText('boom')).toBeNull();
    expect(screen.getByText("Couldn't load email delivery. Try again.")).toBeInTheDocument();
  });

  it('@contract shows the empty state without recorded events', () => {
    mockQuery({ events: [] });

    renderPanel();

    expect(screen.getByText('No email events')).toBeInTheDocument();
  });

  it('@contract groups events per message and expands to recipient details', async () => {
    const user = userEvent.setup();
    mockQuery({
      events: [
        makeEvent({ id: 'e1', status: 'sent', occurredAt: '2026-06-15T11:00:00.000Z' }),
        makeEvent({ id: 'e2', status: 'delivered', occurredAt: '2026-06-15T11:05:00.000Z' }),
      ],
    });

    renderPanel();

    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('booking_confirmation')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /booking_confirmation/ }));

    expect(await screen.findByText('Recipient: alex@example.com')).toBeInTheDocument();
    expect(screen.getAllByText(/Sent|Delivered/i).length).toBeGreaterThanOrEqual(2);
  });
});
