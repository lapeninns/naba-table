import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRestaurantScheduleMock = vi.hoisted(() => vi.fn());
const getRestaurantTurnBandsMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/restaurants/schedule', () => ({
  getRestaurantSchedule: getRestaurantScheduleMock,
}));

vi.mock('@/server/restaurants/turnBands', () => ({
  getRestaurantTurnBands: getRestaurantTurnBandsMock,
}));

import { getGuestBookingSchedule } from '@/server/restaurants/guestBookingSchedule';

import type { RestaurantSchedule } from '@/server/restaurants/schedule';

function buildSchedule(lastSeatingBufferMinutes = 30): RestaurantSchedule {
  const values = ['20:00', '20:30', '21:00', '21:30'] as const;
  return {
    restaurantId: 'restaurant-1',
    date: '2026-07-01',
    timezone: 'Europe/London',
    notes: null,
    intervalMinutes: 30,
    defaultDurationMinutes: 90,
    lastSeatingBufferMinutes,
    window: { opensAt: '17:00', closesAt: '22:00' },
    isClosed: false,
    availableBookingOptions: ['dinner'],
    slots: values.map((value) => ({
      value,
      display: value,
      periodId: 'dinner-period',
      periodName: 'Dinner',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      availability: {
        services: { dinner: 'enabled' },
        labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
      },
      disabled: false,
    })),
    occasionCatalog: [],
  };
}

describe('getGuestBookingSchedule', () => {
  beforeEach(() => {
    getRestaurantScheduleMock.mockReset().mockResolvedValue(buildSchedule());
    getRestaurantTurnBandsMock.mockReset().mockResolvedValue({
      dinner: [
        { maxPartySize: 2, durationMinutes: 60 },
        { maxPartySize: 4, durationMinutes: 90 },
        { maxPartySize: 12, durationMinutes: 120 },
      ],
    });
  });

  it('returns later slots for a smaller party when its resolved turn is shorter', async () => {
    const schedule = await getGuestBookingSchedule('restaurant-1', {
      date: '2026-07-01',
      partySize: 2,
    });

    expect(schedule.evaluatedPartySize).toBe(2);
    expect(schedule.slots.map((slot) => slot.value)).toEqual(['20:00', '20:30', '21:00']);
    expect(schedule.slots.at(-1)?.durationMinutes).toBe(60);
    expect(schedule.availableBookingOptions).toEqual(['dinner']);
    expect(getRestaurantTurnBandsMock).toHaveBeenCalledTimes(1);
  });

  it('removes starts that cannot fit the larger party turn before close', async () => {
    const schedule = await getGuestBookingSchedule('restaurant-1', {
      date: '2026-07-01',
      partySize: 4,
    });

    expect(schedule.slots.map((slot) => slot.value)).toEqual(['20:00', '20:30']);
    expect(schedule.slots.at(-1)?.durationMinutes).toBe(90);
  });

  it('uses the last-seating buffer when it is stricter than the party turn', async () => {
    getRestaurantScheduleMock.mockResolvedValue(buildSchedule(90));

    const schedule = await getGuestBookingSchedule('restaurant-1', {
      date: '2026-07-01',
      partySize: 2,
    });

    expect(schedule.slots.map((slot) => slot.value)).toEqual(['20:00', '20:30']);
  });

  it('fails closed for overnight guest schedules without changing the raw schedule contract', async () => {
    getRestaurantScheduleMock.mockResolvedValue({
      ...buildSchedule(),
      window: { opensAt: '18:00', closesAt: '02:00' },
    });

    const schedule = await getGuestBookingSchedule('restaurant-1', {
      date: '2026-07-01',
      partySize: 2,
    });

    expect(schedule.slots).toEqual([]);
    expect(schedule.availableBookingOptions).toEqual([]);
  });
});
