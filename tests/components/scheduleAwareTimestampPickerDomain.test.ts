import { describe, expect, it } from 'vitest';

import {
  OVERRIDE_SELECTION_COPY,
  UNAVAILABLE_SELECTION_COPY,
  buildMonthDateKeys,
  deriveMaskAvailability,
  extractDateParts,
  getAvailableScheduleSlots,
  mergeWithSyntheticSlots,
  resolveScheduleAwareTimeChange,
  resolveSelectedTimeValidationMessage,
  resolveUnavailableMessage,
  toIsoString,
} from '@/components/features/booking-state-machine/scheduleAwareTimestampPickerDomain';

import type { ReservationSchedule } from '@reserve/features/reservations/wizard/services/timeSlots';
import type { TimeSlotDescriptor } from '@reserve/features/reservations/wizard/services/timeSlots';

function makeSlot(overrides: Partial<TimeSlotDescriptor> & { value: string }): TimeSlotDescriptor {
  return {
    value: overrides.value,
    display: overrides.display ?? overrides.value,
    label: overrides.label ?? 'Lunch',
    bookingOption: overrides.bookingOption ?? 'lunch',
    defaultBookingOption: overrides.defaultBookingOption ?? 'lunch',
    availability: overrides.availability ?? {
      services: { lunch: 'available' },
      labels: {
        dinnerWindow: false,
        kitchenClosed: false,
        lunchWindow: true,
      },
    },
    disabled: overrides.disabled ?? false,
    periodId: overrides.periodId ?? null,
  };
}

function makeSchedule(): ReservationSchedule {
  return {
    availableBookingOptions: ['lunch'],
    date: '2026-05-20',
    intervalMinutes: 15,
    isClosed: false,
    slots: [
      {
        value: '12:00',
        display: '12:00',
        periodId: null,
        periodName: null,
        bookingOption: 'lunch',
        defaultBookingOption: 'lunch',
        availability: {
          services: { lunch: 'available' },
          labels: {
            dinnerWindow: false,
            kitchenClosed: false,
            lunchWindow: true,
          },
        },
        disabled: false,
      },
      {
        value: '15:00',
        display: '15:00',
        periodId: null,
        periodName: null,
        bookingOption: 'lunch',
        defaultBookingOption: 'lunch',
        availability: {
          services: { lunch: 'available' },
          labels: {
            dinnerWindow: false,
            kitchenClosed: false,
            lunchWindow: true,
          },
        },
        disabled: true,
      },
    ],
    timezone: 'Europe/London',
    window: {
      opensAt: '12:00',
      closesAt: '16:00',
    },
  } as ReservationSchedule;
}

describe('scheduleAwareTimestampPickerDomain selection helpers', () => {
  it('keeps timezone date/time conversion deterministic through the facade', () => {
    expect(extractDateParts('2026-05-20T17:00:00.000Z', 'Europe/London')).toEqual({
      date: '2026-05-20',
      time: '18:00',
    });
    expect(extractDateParts('not-a-date', 'Europe/London')).toEqual({
      date: null,
      time: null,
    });
    expect(toIsoString('2026-05-20', '18:00', 'Europe/London')).toBe('2026-05-20T17:00:00.000Z');
    expect(toIsoString('2026-05-20', '99:99', 'Europe/London')).toBeNull();
  });

  it('derives calendar mask availability without leaking loader state', () => {
    expect(
      Array.from(
        deriveMaskAvailability(
          {
            from: '2026-05-18',
            to: '2026-05-20',
            timezone: 'Europe/London',
            closedDates: ['2026-05-19'],
            closedDaysOfWeek: [3],
          },
          new Date(2026, 4, 19).getTime(),
        ).entries(),
      ),
    ).toEqual([
      ['2026-05-19', 'closed'],
      ['2026-05-20', 'closed'],
    ]);
  });

  it('builds month date keys after the minimum date', () => {
    expect(buildMonthDateKeys(new Date(2026, 4, 1), new Date(2026, 4, 30))).toEqual([
      '2026-05-30',
      '2026-05-31',
    ]);
  });

  it('merges synthetic disabled slots into sparse schedules', () => {
    const merged = mergeWithSyntheticSlots(makeSchedule());

    expect(merged?.slots.map((slot) => slot.value)).toEqual([
      '12:00',
      '12:15',
      '12:30',
      '12:45',
      '13:00',
      '13:15',
      '13:30',
      '13:45',
      '14:00',
      '14:15',
      '14:30',
      '14:45',
      '15:00',
    ]);
    expect(merged?.slots.find((slot) => slot.value === '12:15')?.disabled).toBe(true);
  });

  it('filters available slots by capacity or target service', () => {
    const slots = [
      makeSlot({ value: '12:00' }),
      makeSlot({
        value: '12:30',
        availability: {
          services: { lunch: 'disabled', dinner: 'available' },
          labels: {
            dinnerWindow: true,
            kitchenClosed: false,
            lunchWindow: false,
          },
        },
      }),
      makeSlot({ value: '13:00', disabled: true }),
    ];

    expect(getAvailableScheduleSlots(slots, null).map((slot) => slot.value)).toEqual(['12:00']);
    expect(getAvailableScheduleSlots(slots, 'dinner').map((slot) => slot.value)).toEqual([
      '12:00',
      '12:30',
    ]);
  });

  it('resolves selected-time validation copy without React state', () => {
    const schedule = makeSchedule();
    const availableSlots = [makeSlot({ value: '12:00' })];

    expect(
      resolveSelectedTimeValidationMessage({
        availableSlots,
        schedule,
        selectedTime: '12:00',
      }),
    ).toBeNull();
    expect(
      resolveSelectedTimeValidationMessage({
        availableSlots,
        schedule,
        selectedTime: '12:30',
      }),
    ).toBeNull();
    expect(
      resolveSelectedTimeValidationMessage({
        availableSlots,
        schedule: null,
        selectedTime: '23:00',
      }),
    ).toBe(UNAVAILABLE_SELECTION_COPY);
    expect(
      resolveSelectedTimeValidationMessage({
        availableSlots: [],
        schedule: null,
        selectedTime: '23:00',
      }),
    ).toBe(OVERRIDE_SELECTION_COPY);
  });

  it('maps unavailable date reasons to user-facing copy', () => {
    expect(resolveUnavailableMessage('closed')).toContain('closed');
    expect(resolveUnavailableMessage('no-slots')).toContain('taken');
    expect(resolveUnavailableMessage('unknown')).toContain('load availability');
    expect(resolveUnavailableMessage(null)).toBeUndefined();
  });

  it('resolves draft-only time edits without committing or blurring', () => {
    expect(
      resolveScheduleAwareTimeChange({
        availableSlots: [],
        currentSchedule: null,
        intervalMinutes: 15,
        isScheduleLoading: false,
        next: '13',
        selectedTime: '12:00',
        shouldCommit: false,
      }),
    ).toEqual({
      draftTime: '13',
      selectedTime: '12:00',
      timeValidationError: null,
      shouldBlur: false,
      shouldResetSelectionMode: false,
    });
  });

  it('resolves invalid time edits by reverting draft time and clearing empty commits', () => {
    expect(
      resolveScheduleAwareTimeChange({
        availableSlots: [],
        currentSchedule: makeSchedule(),
        intervalMinutes: 15,
        isScheduleLoading: false,
        next: '99:99',
        selectedTime: '',
      }),
    ).toEqual({
      draftTime: '',
      selectedTime: '',
      timeValidationError: 'Enter a valid time.',
      commitTime: null,
      shouldBlur: true,
      shouldResetSelectionMode: false,
    });
  });

  it('commits normalized times while schedule availability is still loading', () => {
    expect(
      resolveScheduleAwareTimeChange({
        availableSlots: [],
        currentSchedule: null,
        intervalMinutes: 15,
        isScheduleLoading: true,
        next: '12:07',
        selectedTime: '',
      }),
    ).toMatchObject({
      draftTime: '12:00',
      selectedTime: '12:00',
      timeValidationError: null,
      commitTime: '12:00',
      shouldBlur: true,
      shouldResetSelectionMode: true,
    });
  });

  it('allows within-window override commits and rejects outside-window selections', () => {
    const schedule = makeSchedule();

    expect(
      resolveScheduleAwareTimeChange({
        availableSlots: [makeSlot({ value: '12:00' })],
        currentSchedule: schedule,
        intervalMinutes: 15,
        isScheduleLoading: false,
        next: '12:30',
        selectedTime: '12:00',
      }),
    ).toMatchObject({
      draftTime: '12:30',
      selectedTime: '12:30',
      commitTime: '12:30',
      timeValidationError: null,
      shouldResetSelectionMode: true,
    });

    expect(
      resolveScheduleAwareTimeChange({
        availableSlots: [makeSlot({ value: '12:00' })],
        currentSchedule: schedule,
        intervalMinutes: 15,
        isScheduleLoading: false,
        next: '20:00',
        selectedTime: '12:00',
      }),
    ).toEqual({
      draftTime: '12:00',
      selectedTime: '12:00',
      timeValidationError: UNAVAILABLE_SELECTION_COPY,
      commitTime: undefined,
      shouldBlur: true,
      shouldResetSelectionMode: false,
    });
  });
});
