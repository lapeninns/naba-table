import { describe, expect, it } from 'vitest';

import {
  buildDevBookingFixtureCalendarMask,
  buildDevBookingFixtureSchedule,
  isDevBookingFixtureRestaurant,
} from '@/server/restaurants/devBookingFixture';

describe('dev booking fixture restaurant helpers', () => {
  it('recognizes the local guest booking fixture restaurant id', () => {
    expect(
      isDevBookingFixtureRestaurant('11111111-1111-4111-8111-111111111111'),
    ).toBe(true);
    expect(isDevBookingFixtureRestaurant('00000000-0000-4000-8000-000000000000')).toBe(false);
  });

  it('builds a deterministic dinner schedule for the public booking fixture route', () => {
    const schedule = buildDevBookingFixtureSchedule('2026-03-25');

    expect(schedule.restaurantId).toBe('11111111-1111-4111-8111-111111111111');
    expect(schedule.date).toBe('2026-03-25');
    expect(schedule.timezone).toBe('Europe/London');
    expect(schedule.availableBookingOptions).toEqual(['dinner']);
    expect(schedule.slots.some((slot) => slot.value === '19:00' && slot.disabled === false)).toBe(
      true,
    );
  });

  it('builds an open calendar mask for the fixture route', () => {
    expect(
      buildDevBookingFixtureCalendarMask({
        from: '2026-03-01',
        to: '2026-03-31',
      }),
    ).toEqual({
      timezone: 'Europe/London',
      from: '2026-03-01',
      to: '2026-03-31',
      closedDaysOfWeek: [],
      closedDates: [],
    });
  });
});
