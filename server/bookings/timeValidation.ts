import { normalizeTime, toMinutes } from '@reserve/shared/time';

import type { ReservationTime } from '@reserve/shared/time';

import { calculateDurationMinutes } from '@/server/bookings';
import type { RestaurantSchedule } from '@/server/restaurants/schedule';
import type { BookingType } from '@/lib/enums';

export type OperatingHoursErrorReason = 'CLOSED' | 'INVALID_TIME' | 'OUTSIDE_WINDOW' | 'AFTER_CLOSE';

export class OperatingHoursError extends Error {
  readonly reason: OperatingHoursErrorReason;

  constructor(reason: OperatingHoursErrorReason, message: string) {
    super(message);
    this.name = 'OperatingHoursError';
    this.reason = reason;
  }
}

export type BookingOperatingWindow = Pick<RestaurantSchedule, 'isClosed' | 'slots' | 'window'>;

export type AssertBookingWithinOperatingWindowParams = {
  schedule: BookingOperatingWindow;
  requestedTime: string;
  bookingType: BookingType;
};

export type BookingOperatingWindowResult = {
  time: ReservationTime;
};

function ensureSlotExists(schedule: BookingOperatingWindow, time: ReservationTime) {
  const slot = schedule.slots.find((entry) => entry.value === time && !entry.disabled);
  if (!slot) {
    throw new OperatingHoursError('OUTSIDE_WINDOW', 'Selected time is outside operating hours.');
  }
}

function ensureWithinWindowBounds(schedule: BookingOperatingWindow, time: ReservationTime, bookingType: BookingType) {
  const opensAt = schedule.window.opensAt;
  const closesAt = schedule.window.closesAt;
  const startMinutes = toMinutes(time);

  if (opensAt) {
    const opensMinutes = toMinutes(opensAt);
    if (startMinutes < opensMinutes) {
      throw new OperatingHoursError('OUTSIDE_WINDOW', 'Selected time is outside operating hours.');
    }
  }

  if (closesAt) {
    const closesMinutes = toMinutes(closesAt);
    const durationMinutes = calculateDurationMinutes(bookingType);
    const endMinutes = startMinutes + durationMinutes;

    if (endMinutes > closesMinutes) {
      throw new OperatingHoursError('AFTER_CLOSE', 'Selected time extends beyond closing hours.');
    }
  }
}

export function assertBookingWithinOperatingWindow({
  schedule,
  requestedTime,
  bookingType,
}: AssertBookingWithinOperatingWindowParams): BookingOperatingWindowResult {
  if (schedule.isClosed) {
    throw new OperatingHoursError('CLOSED', 'Restaurant is closed on the selected date.');
  }

  const normalizedTime = normalizeTime(requestedTime);
  if (!normalizedTime) {
    throw new OperatingHoursError('INVALID_TIME', 'Selected time is invalid.');
  }

  ensureSlotExists(schedule, normalizedTime);
  ensureWithinWindowBounds(schedule, normalizedTime, bookingType);

  return { time: normalizedTime } satisfies BookingOperatingWindowResult;
}
