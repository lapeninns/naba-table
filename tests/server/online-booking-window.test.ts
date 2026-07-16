import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { evaluateOnlineBookingWindow } from '@/server/booking/online-booking-window';

function evaluate(overrides: {
  readonly durationMinutes?: number;
  readonly lastSeatingBufferMinutes?: number;
  readonly opensAt?: string;
  readonly closesAt?: string;
  readonly startTime?: string;
}) {
  const startTime = overrides.startTime ?? '20:30';
  return evaluateOnlineBookingWindow({
    closesAt: overrides.closesAt ?? '22:00',
    durationMinutes: overrides.durationMinutes ?? 90,
    lastSeatingBufferMinutes: overrides.lastSeatingBufferMinutes ?? 30,
    opensAt: overrides.opensAt ?? '17:00',
    scheduleDate: '2026-07-01',
    startDateTime: DateTime.fromISO(`2026-07-01T${startTime}`, {
      zone: 'Europe/London',
    }),
    startTime,
  });
}

describe('evaluateOnlineBookingWindow', () => {
  it('accepts a booking whose dining end equals close', () => {
    const result = evaluate({});

    expect(result.issues).toEqual([]);
    expect(result.endTime).toBe('22:00');
  });

  it('rejects a start when the last-seating buffer is stricter than duration', () => {
    const result = evaluate({
      durationMinutes: 60,
      lastSeatingBufferMinutes: 90,
      startTime: '21:00',
    });

    expect(result.issues).toEqual([
      expect.objectContaining({
        code: 'OUTSIDE_HOURS',
        detail: expect.objectContaining({ lastSeatingTime: '20:30' }),
      }),
    ]);
  });

  it('rejects a start when duration extends beyond close', () => {
    const result = evaluate({
      durationMinutes: 90,
      lastSeatingBufferMinutes: 30,
      startTime: '21:00',
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'OUTSIDE_HOURS',
          detail: expect.objectContaining({ endTime: '22:30' }),
        }),
      ]),
    );
  });

  it('fails closed for overnight operating windows', () => {
    const result = evaluate({
      opensAt: '18:00',
      closesAt: '02:00',
      startTime: '20:00',
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'OUTSIDE_HOURS',
          detail: expect.objectContaining({ reason: 'overnight_window_unsupported' }),
        }),
      ]),
    );
  });
});
