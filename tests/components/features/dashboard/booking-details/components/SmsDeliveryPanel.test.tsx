import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const { useSmsLogMock } = vi.hoisted(() => ({
  useSmsLogMock: vi.fn(),
}));

vi.mock('@/hooks/ops/useOpsBookingSmsDeliveryLog', () => ({
  useOpsBookingSmsDeliveryLog: useSmsLogMock,
}));

import { SmsDeliveryPanel } from '@/components/features/dashboard/booking-details/components/SmsDeliveryPanel';

import { PINNED_TIMEZONE } from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { SmsDeliveryEventDTO } from '@/types/smsDelivery';

function makeEvent(overrides: Partial<SmsDeliveryEventDTO> = {}): SmsDeliveryEventDTO {
  return {
    id: 'event-1',
    bookingId: 'booking-1',
    restaurantId: 'restaurant-1',
    smsType: 'booking_confirmation',
    recipientPhone: '+447700900123',
    messageSid: 'sid-1',
    status: 'delivered',
    provider: null,
    occurredAt: '2026-06-15T12:00:00.000Z',
    error: null,
    metadata: null,
    ...overrides,
  };
}

function mockQuery(overrides: Record<string, unknown> = {}) {
  useSmsLogMock.mockReturnValue({
    isLoading: false,
    error: null,
    events: [],
    unavailable: false,
    apiError: null,
    ...overrides,
  });
}

function renderPanel() {
  return render(<SmsDeliveryPanel bookingId="booking-1" timezone={PINNED_TIMEZONE} />);
}

describe('SmsDeliveryPanel', () => {
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

  it('@contract shows the empty state without recorded events', () => {
    mockQuery({ events: [] });

    renderPanel();

    expect(screen.getByText('No message events')).toBeInTheDocument();
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

    expect(screen.getByText('SMS Observability')).toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /confirmation/i });
    await user.click(trigger);

    expect(await screen.findByText(/\+447700900123/)).toBeInTheDocument();
  });
});
