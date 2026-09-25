import { DateTime } from 'luxon';

import { evaluateOnlineBookingWindow } from '@/lib/restaurants/guest-schedule/online-booking-window';
import { resolveBookingDurationMinutes } from '@/server/bookings/duration';
import { getRestaurantSchedule } from '@/server/restaurants/schedule';
import { getRestaurantTurnBands } from '@/server/restaurants/turnBands';

import type { RestaurantSchedule, RestaurantScheduleSlot } from '@/server/restaurants/schedule';

type GuestScheduleClient = NonNullable<Parameters<typeof getRestaurantSchedule>[1]>['client'];

export type GuestRestaurantScheduleSlot = RestaurantScheduleSlot & {
  readonly durationMinutes: number;
};

export type GuestRestaurantSchedule = Omit<RestaurantSchedule, 'slots'> & {
  readonly evaluatedPartySize: number;
  readonly slots: GuestRestaurantScheduleSlot[];
};

export async function getGuestBookingSchedule(
  restaurantId: string,
  options: {
    readonly client?: GuestScheduleClient;
    readonly date?: string;
    readonly partySize: number;
  },
): Promise<GuestRestaurantSchedule> {
  const [schedule, turnBandsByOption] = await Promise.all([
    getRestaurantSchedule(restaurantId, {
      date: options.date,
      client: options.client,
    }),
    getRestaurantTurnBands(restaurantId, options.client),
  ]);

  const evaluatedSlots = await Promise.all(
    schedule.slots.map(async (slot): Promise<GuestRestaurantScheduleSlot | null> => {
      const { durationMinutes } = await resolveBookingDurationMinutes({
        restaurantId,
        bookingDate: schedule.date,
        startTime: slot.value,
        partySize: options.partySize,
        bookingOption: slot.defaultBookingOption ?? slot.bookingOption,
        turnBandsByOption,
        timezone: schedule.timezone,
        client: options.client,
      });
      const startDateTime = DateTime.fromISO(`${schedule.date}T${slot.value}`, {
        zone: schedule.timezone,
      });
      const evaluation = evaluateOnlineBookingWindow({
        closesAt: schedule.window.closesAt,
        durationMinutes,
        lastSeatingBufferMinutes: schedule.lastSeatingBufferMinutes,
        opensAt: schedule.window.opensAt,
        scheduleDate: schedule.date,
        startDateTime,
        startTime: slot.value,
      });

      return evaluation.issues.length === 0 ? { ...slot, durationMinutes } : null;
    }),
  );
  const slots = evaluatedSlots.filter((slot): slot is GuestRestaurantScheduleSlot => slot !== null);
  const availableBookingOptions = Array.from(
    new Set(slots.filter((slot) => !slot.disabled).map((slot) => slot.bookingOption)),
  );

  return {
    ...schedule,
    evaluatedPartySize: options.partySize,
    slots,
    availableBookingOptions,
  };
}
