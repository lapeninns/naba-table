import { render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { ArrivalCountdown } from '@/components/features/dashboard/booking-details/components/ArrivalCountdown';

import {
  PINNED_DATE_KEY,
  PINNED_NOW_ISO,
  PINNED_TIMEZONE,
} from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

// 13:00 in Europe/London on the pinned day; passed explicitly so no test
// depends on the host clock or timezone.
const NOW = DateTime.fromISO(PINNED_NOW_ISO).setZone(PINNED_TIMEZONE);

function renderCountdown(
  overrides: Partial<Parameters<typeof ArrivalCountdown>[0]> = {},
) {
  return render(
    <ArrivalCountdown
      status="confirmed"
      startTime="13:30"
      date={PINNED_DATE_KEY}
      timezone={PINNED_TIMEZONE}
      now={NOW}
      {...overrides}
    />,
  );
}

describe('ArrivalCountdown', () => {
  it('@contract announces an upcoming arrival inside the 60-minute window', () => {
    renderCountdown();

    expect(screen.getByRole('status')).toHaveTextContent('Arriving in 30m');
  });

  it('@contract drops the prefix in compact mode', () => {
    renderCountdown({ compact: true });

    expect(screen.getByRole('status')).toHaveTextContent(/^30m$/);
  });

  it('@contract flags late arrivals', () => {
    renderCountdown({ startTime: '12:45' });

    expect(screen.getByRole('status')).toHaveTextContent('Late 15m');
  });

  it('@contract stays hidden outside the 60-minute window', () => {
    const { container } = renderCountdown({ startTime: '16:00' });

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract stays hidden for seated and finished bookings', () => {
    const { container } = renderCountdown({ status: 'checked_in' });
    expect(container).toBeEmptyDOMElement();

    const { container: completed } = renderCountdown({ status: 'completed' });
    expect(completed).toBeEmptyDOMElement();
  });

  it('@contract stays hidden without a start time', () => {
    const { container } = renderCountdown({ startTime: null });

    expect(container).toBeEmptyDOMElement();
  });
});
