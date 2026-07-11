import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DialogHeader } from '@/components/features/dashboard/booking-details/components/DialogHeader';

import {
  PINNED_DATE_KEY,
  PINNED_NOW_ISO,
  PINNED_TIMEZONE,
  makeBooking,
} from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { DialogHeaderProps } from '@/components/features/dashboard/booking-details/components/DialogHeader';

function makeProps(overrides: Partial<DialogHeaderProps> = {}): DialogHeaderProps {
  return {
    booking: makeBooking(),
    status: 'confirmed',
    formattedDate: 'Mon 15 Jun',
    formattedStartTime: '18:00',
    bookingDate: PINNED_DATE_KEY,
    timezone: PINNED_TIMEZONE,
    minutesRemaining: null,
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('DialogHeader', () => {
  beforeEach(() => {
    // The embedded ArrivalCountdown reads DateTime.now(); pin it.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(PINNED_NOW_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract renders the guest name with time, party, date, and reference chips', () => {
    render(<DialogHeader {...makeProps()} />);

    expect(screen.getByRole('heading', { name: 'Alex Example' })).toBeInTheDocument();
    expect(screen.getByText('18:00')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Mon 15 Jun')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy reference' })).toHaveTextContent('REF-1234');
  });

  it('@contract falls back to a generic title without a booking', () => {
    render(<DialogHeader {...makeProps({ booking: null })} />);

    expect(screen.getByRole('heading', { name: 'Booking details' })).toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy reference' })).not.toBeInTheDocument();
  });

  it('@contract the close button fires onClose', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<DialogHeader {...props} />);

    await user.click(screen.getByRole('button', { name: 'Close booking details' }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('@contract shows the compact countdown for an imminent booking', () => {
    // Booking starts 13:25 Europe/London; pinned now is 13:00 → "25m".
    render(
      <DialogHeader
        {...makeProps({
          booking: makeBooking({ startTime: '13:25' }),
          minutesRemaining: 25,
        })}
      />,
    );

    // The status badge also carries role="status", so target the countdown text.
    expect(screen.getByText('25m')).toBeInTheDocument();
  });

  it('@contract hides the countdown for finished bookings', () => {
    render(
      <DialogHeader
        {...makeProps({
          status: 'completed',
          booking: makeBooking({ startTime: '13:25' }),
          minutesRemaining: 25,
        })}
      />,
    );

    expect(screen.queryByText('25m')).not.toBeInTheDocument();
  });
});
