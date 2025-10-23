import { describe, expect, it } from 'vitest';

import {
  getDisabledDays,
  getLatestStartMinutes,
  getTimeSlots,
  hasCapacity,
  isDateUnavailable,
  isPastOrClosing,
} from '../availability';

import type {
  ReservationSchedule,
  RawScheduleSlot,
} from '@reserve/features/reservations/wizard/services/timeSlots';

const buildSlot = (overrides?: Partial<RawScheduleSlot>): RawScheduleSlot => ({
  value: '18:00',
  display: '6:00 PM',
  periodId: null,
  periodName: 'Dinner',
  bookingOption: 'dinner',
  defaultBookingOption: 'dinner',
  availability: {
    services: {
      dinner: 'enabled',
    },
    labels: {
      happyHour: false,
      drinksOnly: false,
      kitchenClosed: false,
      lunchWindow: false,
      dinnerWindow: true,
    },
  },
  disabled: false,
  ...overrides,
});

const buildSchedule = (overrides?: Partial<ReservationSchedule>): ReservationSchedule => ({
  restaurantId: 'restaurant-1',
  date: '2025-01-01',
  timezone: 'Europe/London',
  intervalMinutes: 15,
  defaultDurationMinutes: 90,
  lastSeatingBufferMinutes: 120,
  window: {
    opensAt: '09:00',
    closesAt: '22:00',
  },
  isClosed: false,
  availableBookingOptions: ['dinner'],
  slots: [buildSlot()],
  occasionCatalog: [],
  ...overrides,
});

describe('availability adapter helpers', () => {
  it('marks closed schedules as unavailable', () => {
    const schedules = new Map<string, ReservationSchedule | null>();
    schedules.set('2025-01-01', buildSchedule({ isClosed: true, slots: [] }));

    const disabled = getDisabledDays(schedules);
    expect(disabled.get('2025-01-01')).toBe('closed');
  });

  it('marks schedules without available slots as no-slots', () => {
    const schedules = new Map<string, ReservationSchedule | null>();
    schedules.set(
      '2025-01-01',
      buildSchedule({
        slots: [
          buildSlot({
            disabled: true,
            availability: {
              services: { dinner: 'disabled' },
              labels: {
                happyHour: false,
                drinksOnly: false,
                kitchenClosed: false,
                lunchWindow: false,
                dinnerWindow: false,
              },
            },
          }),
        ],
      }),
    );

    const disabled = getDisabledDays(schedules);
    expect(disabled.get('2025-01-01')).toBe('no-slots');
  });

  it('treats missing schedules as unknown unavailability', () => {
    const schedules = new Map<string, ReservationSchedule | null>();
    schedules.set('2025-01-02', null);

    expect(isDateUnavailable('2025-01-02', schedules)).toBe('unknown');
    expect(getDisabledDays(schedules).get('2025-01-02')).toBe('unknown');
  });

  it('returns time slots for a given date', () => {
    const schedules = new Map<string, ReservationSchedule | null>();
    schedules.set('2025-01-01', buildSchedule());

    const slots = getTimeSlots('2025-01-01', schedules);
    expect(slots).toHaveLength(1);
    expect(slots[0]?.value).toBe('18:00');
  });

  it('detects past selections and closing guard violations', () => {
    const schedule = buildSchedule();

    expect(
      isPastOrClosing({
        date: '2025-01-01',
        time: '10:00',
        schedule,
        now: new Date('2025-01-01T18:00:00Z'),
      }),
    ).toBe(true);

    // Latest start = 22:00 - max(120, 90) = 20:00, so 21:00 is invalid
    expect(
      isPastOrClosing({
        date: '2025-01-01',
        time: '21:00',
        schedule,
        now: new Date('2024-12-31T18:00:00Z'),
      }),
    ).toBe(true);

    expect(
      isPastOrClosing({
        date: '2025-01-01',
        time: '19:00',
        schedule,
        now: new Date('2025-01-01T17:00:00Z'),
      }),
    ).toBe(false);
  });

  it('evaluates slot capacity based on disabled state and service availability', () => {
    const [available, disabledSlot] = [
      buildSlot(),
      buildSlot({
        disabled: false,
        availability: {
          services: { dinner: 'disabled' },
          labels: {
            happyHour: false,
            drinksOnly: false,
            kitchenClosed: false,
            lunchWindow: false,
            dinnerWindow: false,
          },
        },
      }),
    ].map(
      (slot) => getTimeSlots('2025-01-01', { '2025-01-01': buildSchedule({ slots: [slot] }) })[0],
    );

    expect(hasCapacity(available)).toBe(true);
    expect(hasCapacity(disabledSlot)).toBe(false);
  });

  it('returns latest permissible start minutes when closing window present', () => {
    const schedule = buildSchedule({
      window: { opensAt: '09:00', closesAt: '23:00' },
      defaultDurationMinutes: 60,
      lastSeatingBufferMinutes: 45,
    });
    const minutes = getLatestStartMinutes(schedule);
    // guard = max(45, 60) = 60 -> 23:00 - 60 = 22:00 = 1320 minutes
    expect(minutes).toBe(22 * 60);
  });
});
