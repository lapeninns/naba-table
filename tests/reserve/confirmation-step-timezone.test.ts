import { describe, expect, it } from 'vitest';

import { buildReservationWindow } from '@features/reservations/wizard/hooks/useConfirmationStep';

describe('confirmation step reservation window', () => {
  it('constructs calendar instants in the restaurant timezone', () => {
    const window = buildReservationWindow({
      details: {
        date: '2026-07-01',
        time: '19:30',
        restaurantTimezone: 'Europe/London',
        reservationDurationMinutes: 90,
      },
      lastConfirmed: null,
    } as never);

    expect(window?.start.toISOString()).toBe('2026-07-01T18:30:00.000Z');
    expect(window?.end.toISOString()).toBe('2026-07-01T20:00:00.000Z');
  });
});
