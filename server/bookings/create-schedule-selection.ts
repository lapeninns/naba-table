import { assertBookingWithinOperatingWindow } from '@/server/bookings/timeValidation';

import type { BookingType } from '@/lib/enums';
import type { RestaurantSchedule } from '@/server/restaurants/schedule';
import type { ReservationTime } from '@reserve/shared/time';

export type BookingCreateScheduleSelection = {
  startTime: ReservationTime;
  bookingType: BookingType;
  scheduleTimezone: string;
};

export function resolveBookingCreateScheduleSelection({
  schedule,
  requestedTime,
  fallbackBookingType,
}: {
  schedule: RestaurantSchedule;
  requestedTime: string;
  fallbackBookingType: BookingType;
}): BookingCreateScheduleSelection {
  const { time } = assertBookingWithinOperatingWindow({
    schedule,
    requestedTime,
  });

  const matchedSlot = schedule.slots.find((slot) => slot.value === time && !slot.disabled);
  const bookingType =
    matchedSlot?.bookingOption === 'lunch' || matchedSlot?.bookingOption === 'dinner'
      ? matchedSlot.bookingOption
      : fallbackBookingType;

  return {
    startTime: time,
    bookingType,
    scheduleTimezone: schedule.timezone,
  };
}
