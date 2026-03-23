import { describe, expect, it } from 'vitest';

import { getSlotsByService } from '@reserve/shared/time/reservations';

import type { ReservationConfig } from '@reserve/shared/config/reservations';

const config: ReservationConfig = {
  timezone: 'Europe/London',
  opening: {
    open: '12:00',
    close: '22:00',
    intervalMinutes: 30,
  },
  windows: {
    weekdayLunchEnd: '15:00',
    weekendLunchEnd: '17:00',
    dinnerStart: '17:00',
  },
  defaultDurationMinutes: 90,
  copy: {
    unavailableTooltip: 'Not available for the selected time.',
  },
};

describe('getSlotsByService', () => {
  it('uses exclusive weekday lunch and dinner end times', () => {
    const result = getSlotsByService('2026-03-27', config);

    expect(result.lunch).toEqual(['12:00', '12:30', '13:00', '13:30', '14:00', '14:30']);
    expect(result.dinner).toEqual([
      '17:00',
      '17:30',
      '18:00',
      '18:30',
      '19:00',
      '19:30',
      '20:00',
      '20:30',
      '21:00',
      '21:30',
    ]);
  });

  it('uses exclusive weekend lunch and dinner end times without overlap', () => {
    const result = getSlotsByService('2026-03-28', config);

    expect(result.lunch).toEqual([
      '12:00',
      '12:30',
      '13:00',
      '13:30',
      '14:00',
      '14:30',
      '15:00',
      '15:30',
      '16:00',
      '16:30',
    ]);
    expect(result.dinner).toEqual([
      '17:00',
      '17:30',
      '18:00',
      '18:30',
      '19:00',
      '19:30',
      '20:00',
      '20:30',
      '21:00',
      '21:30',
    ]);
    expect(result.lunch).not.toContain('17:00');
  });
});
