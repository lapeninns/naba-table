import type { OperatingHoursError } from '@/server/bookings/timeValidation';
import type { RestaurantSchedule } from '@/server/restaurants/schedule';

export type OperatingHoursClosedResponseBody = {
  error: string;
  code: 'OPERATING_HOURS_CLOSED';
  details: {
    reason: OperatingHoursError['reason'];
    requestedTime: string;
    bookingType: string;
    opensAt: RestaurantSchedule['window']['opensAt'] | undefined;
    closesAt: RestaurantSchedule['window']['closesAt'] | undefined;
    firstAvailableSlot: RestaurantSchedule['slots'][number]['value'] | null;
    lastAvailableSlot: RestaurantSchedule['slots'][number]['value'] | null;
    timezone: RestaurantSchedule['timezone'] | undefined;
  };
};

export function buildOperatingHoursClosedResponse(params: {
  error: OperatingHoursError;
  schedule: RestaurantSchedule | null;
  requestedTime: string;
  bookingType: string;
}): {
  body: OperatingHoursClosedResponseBody;
  init: { status: 400 };
} {
  const firstOpenSlot = params.schedule?.slots.find((slot) => !slot.disabled)?.value ?? null;
  const lastOpenSlot =
    params.schedule?.slots
      .slice()
      .reverse()
      .find((slot) => !slot.disabled)?.value ?? null;

  return {
    body: {
      error: params.error.message,
      code: 'OPERATING_HOURS_CLOSED',
      details: {
        reason: params.error.reason,
        requestedTime: params.requestedTime,
        bookingType: params.bookingType,
        opensAt: params.schedule?.window.opensAt,
        closesAt: params.schedule?.window.closesAt,
        firstAvailableSlot: firstOpenSlot,
        lastAvailableSlot: lastOpenSlot,
        timezone: params.schedule?.timezone,
      },
    },
    init: { status: 400 },
  };
}
