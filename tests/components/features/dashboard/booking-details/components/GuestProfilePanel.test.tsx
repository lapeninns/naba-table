import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/features/dashboard/booking-details/components/EmailDeliveryPanel', () => ({
  EmailDeliveryPanel: () => <div data-testid="email-delivery-panel" />,
}));
vi.mock('@/components/features/dashboard/booking-details/components/SmsDeliveryPanel', () => ({
  SmsDeliveryPanel: () => <div data-testid="sms-delivery-panel" />,
}));

import { GuestProfilePanel } from '@/components/features/dashboard/booking-details/components/GuestProfilePanel';

import {
  PINNED_DATE_KEY,
  PINNED_NOW_ISO,
  PINNED_TIMEZONE,
  makeBooking,
  makeFlattenedTable,
} from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { GuestProfilePanelProps } from '@/components/features/dashboard/booking-details/components/GuestProfilePanel';

function makeProps(overrides: Partial<GuestProfilePanelProps> = {}): GuestProfilePanelProps {
  return {
    booking: makeBooking(),
    bookingDate: PINNED_DATE_KEY,
    timezone: PINNED_TIMEZONE,
    status: 'confirmed',
    minutesRemaining: null,
    assignedTableRows: [makeFlattenedTable()],
    totalCapacity: 4,
    capacityPercent: 100,
    ...overrides,
  };
}

describe('GuestProfilePanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(PINNED_NOW_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract composes identity, stats, seating, and timeline for a booking', () => {
    render(<GuestProfilePanel {...makeProps()} />);

    expect(screen.getByRole('heading', { name: 'Alex Example' })).toBeInTheDocument();
    expect(screen.getByText('4 guests')).toBeInTheDocument();
    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('Operation History')).toBeInTheDocument();
    expect(screen.queryByText('Dietary Requirements')).not.toBeInTheDocument();
    expect(screen.queryByText(/Notes & Preferences/)).not.toBeInTheDocument();
  });

  it('@contract shows the countdown section for an imminent booking', () => {
    render(
      <GuestProfilePanel
        {...makeProps({
          booking: makeBooking({ startTime: '13:30' }),
          minutesRemaining: 30,
        })}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Arriving in 30m');
  });

  it('@contract surfaces dietary requirements and notes when present', () => {
    render(
      <GuestProfilePanel
        {...makeProps({
          booking: makeBooking({
            allergies: ['Nuts'],
            notes: 'Window seat please',
            profileNotes: 'VIP regular',
          }),
        })}
      />,
    );

    expect(screen.getByText('Dietary Requirements')).toBeInTheDocument();
    expect(screen.getByText('Dietary (1)')).toBeInTheDocument();
    expect(screen.getByText('Window seat please')).toBeInTheDocument();
    expect(screen.getByText('VIP regular')).toBeInTheDocument();
  });

  it('@contract mounts the delivery panels only after expanding the timeline section', async () => {
    const user = userEvent.setup();
    render(<GuestProfilePanel {...makeProps()} />);

    expect(screen.queryByTestId('email-delivery-panel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Timeline & Delivery/ }));

    expect(screen.getByTestId('email-delivery-panel')).toBeInTheDocument();
    expect(screen.getByTestId('sms-delivery-panel')).toBeInTheDocument();
  });
});
