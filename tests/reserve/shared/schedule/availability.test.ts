import { describe, expect, it } from 'vitest';

import type { ReservationSchedule } from '@reserve/features/reservations/wizard/services/timeSlots';
import {
  filterSelectableTimeSlots,
  isPastOrClosing,
} from '@reserve/shared/schedule/availability';

const baseSchedule = {
  restaurantId: 'rest-1',
  date: '2026-05-20',
  timezone: 'Europe/London',
  notes: null,
  intervalMinutes: 30,
  defaultDurationMinutes: 90,
  lastSeatingBufferMinutes: 15,
  window: { opensAt: '12:00', closesAt: '22:00' },
  isClosed: false,
  availableBookingOptions: ['lunch', 'dinner'] as const,
  occasionCatalog: [],
  slots: [
    {
      value: '12:00',
      display: '12:00 PM',
      periodId: 'lunch',
      periodName: 'Lunch',
      bookingOption: 'lunch' as const,
      defaultBookingOption: 'lunch' as const,
      availability: {
        services: { lunch: 'enabled', dinner: 'disabled' },
        labels: { kitchenClosed: false, lunchWindow: true, dinnerWindow: false },
      },
      disabled: false,
    },
    {
      value: '19:00',
      display: '7:00 PM',
      periodId: 'dinner',
      periodName: 'Dinner',
      bookingOption: 'dinner' as const,
      defaultBookingOption: 'dinner' as const,
      availability: {
        services: { lunch: 'disabled', dinner: 'enabled' },
        labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
      },
      disabled: false,
    },
    {
      value: '20:00',
      display: '8:00 PM',
      periodId: 'dinner',
      periodName: 'Dinner',
      bookingOption: 'dinner' as const,
      defaultBookingOption: 'dinner' as const,
      availability: {
        services: { lunch: 'disabled', dinner: 'enabled' },
        labels: { kitchenClosed: false, lunchWindow: false, dinnerWindow: true },
      },
      disabled: true,
    },
  ],
} satisfies ReservationSchedule;

describe('isPastOrClosing', () => {
  it('treats times at or before now as past for the schedule date', () => {
    const now = new Date('2026-05-20T18:00:00+01:00');

    expect(
      isPastOrClosing({
        date: '2026-05-20',
        time: '12:00',
        schedule: baseSchedule,
        now,
      }),
    ).toBe(true);

    expect(
      isPastOrClosing({
        date: '2026-05-20',
        time: '19:00',
        schedule: baseSchedule,
        now,
      }),
    ).toBe(false);
  });
});

describe('filterSelectableTimeSlots', () => {
  it('drops disabled and past slots for today', () => {
    const now = new Date('2026-05-20T18:00:00+01:00');
    const descriptors = baseSchedule.slots.map((slot) => ({
      value: slot.value,
      display: slot.display,
      label: slot.periodName ?? slot.bookingOption,
      bookingOption: slot.bookingOption,
      defaultBookingOption: slot.defaultBookingOption,
      availability: slot.availability,
      disabled: slot.disabled,
      periodId: slot.periodId,
    }));

    const selectable = filterSelectableTimeSlots(descriptors, {
      date: '2026-05-20',
      schedule: baseSchedule,
      now,
    });

    expect(selectable.map((slot) => slot.value)).toEqual(['19:00']);
  });
});
