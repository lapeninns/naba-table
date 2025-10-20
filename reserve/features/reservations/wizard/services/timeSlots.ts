import type { BookingOption } from '@reserve/shared/booking';
import type { OccasionDefinition, OccasionKey } from '@reserve/shared/occasions';

export type ServiceState = 'enabled' | 'disabled';

export type ServiceAvailability = {
  services: Record<OccasionKey, ServiceState>;
  labels: {
    happyHour: boolean;
    drinksOnly: boolean;
    kitchenClosed: boolean;
    lunchWindow: boolean;
    dinnerWindow: boolean;
  };
};

export const EMPTY_AVAILABILITY: ServiceAvailability = {
  services: {},
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
  availableBookingOptions: BookingOption[];
  slots: RawScheduleSlot[];
  occasionCatalog: OccasionDefinition[];
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
  const trimmedPeriodName = slot.periodName?.trim() ?? '';
  const label =
    trimmedPeriodName.length > 0
      ? trimmedPeriodName
      : slot.bookingOption.replace(/\b\w/g, (char) => char.toUpperCase());

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
