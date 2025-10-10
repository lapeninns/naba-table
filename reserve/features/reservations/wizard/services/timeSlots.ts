import type { BookingOption } from '@reserve/shared/booking';

export type ServiceState = 'enabled' | 'disabled';

export type ServiceAvailability = {
  services: Record<BookingOption, ServiceState>;
  labels: {
    happyHour: boolean;
    drinksOnly: boolean;
    kitchenClosed: boolean;
    lunchWindow: boolean;
    dinnerWindow: boolean;
  };
};

export const EMPTY_AVAILABILITY: ServiceAvailability = {
  services: {
    lunch: 'disabled',
    dinner: 'disabled',
    drinks: 'disabled',
  },
  labels: {
    happyHour: false,
    drinksOnly: false,
    kitchenClosed: false,
    lunchWindow: false,
    dinnerWindow: false,
  },
};

export type RawScheduleSlot = {
  value: string;
  display: string;
  periodId: string | null;
  periodName: string | null;
  bookingOption: BookingOption;
  defaultBookingOption: BookingOption;
  availability: ServiceAvailability;
  disabled: boolean;
};

export type ReservationSchedule = {
  restaurantId: string;
  date: string;
  timezone: string;
  intervalMinutes: number;
  defaultDurationMinutes: number;
  window: {
    opensAt: string | null;
    closesAt: string | null;
  };
  isClosed: boolean;
  slots: RawScheduleSlot[];
};

const DEFAULT_LABELS: Record<BookingOption, string> = {
  lunch: 'Lunch',
  dinner: 'Dinner',
  drinks: 'Drinks & cocktails',
};

export type TimeSlotDescriptor = {
  value: string;
  display: string;
  label: string;
  bookingOption: BookingOption;
  defaultBookingOption: BookingOption;
  availability: ServiceAvailability;
  disabled: boolean;
  periodId: string | null;
};

export function toTimeSlotDescriptor(slot: RawScheduleSlot): TimeSlotDescriptor {
  const label =
    slot.periodName?.trim() && slot.periodName.length > 0
      ? slot.periodName
      : (DEFAULT_LABELS[slot.bookingOption] ?? slot.bookingOption);

  return {
    value: slot.value,
    display: slot.display,
    label,
    bookingOption: slot.bookingOption,
    defaultBookingOption: slot.defaultBookingOption,
    availability: slot.availability,
    disabled: slot.disabled,
    periodId: slot.periodId,
  } satisfies TimeSlotDescriptor;
}
