import { getTodayInTimezone } from '@/lib/utils/datetime';
import { getDefaultBookingLifecycleFixture } from '@/src/app/(public)/dev/_mocks/bookingLifecycleFixtures';
import { toReservationTime } from '@reserve/shared/time';

import type { RestaurantSchedule } from '@/server/restaurants/schedule';
import type { CalendarMask } from '@reserve/features/reservations/wizard/services/schedule';

const FIXTURE_WINDOW = {
  opensAt: '12:00',
  closesAt: '22:00',
} as const;

const FIXTURE_SLOT_VALUES = [
  '18:00',
  '18:15',
  '18:30',
  '18:45',
  '19:00',
  '19:15',
  '19:30',
  '19:45',
  '20:00',
  '20:15',
  '20:30',
] as const;

const getFixtureReservation = () => getDefaultBookingLifecycleFixture().reservation;

export function isDevBookingFixtureRestaurant(restaurantId: string | null | undefined): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return restaurantId?.trim() === getFixtureReservation().restaurantId;
}

export function buildDevBookingFixtureSchedule(
  date?: string | null,
): RestaurantSchedule {
  const reservation = getFixtureReservation();
  const timezone = reservation.restaurantTimezone ?? 'Europe/London';
  const scheduleDate = date?.trim() || getTodayInTimezone(timezone);

  return {
    restaurantId: reservation.restaurantId,
    date: scheduleDate,
    timezone,
    intervalMinutes: 15,
    defaultDurationMinutes: 90,
    lastSeatingBufferMinutes: 0,
    window: {
      opensAt: toReservationTime(FIXTURE_WINDOW.opensAt),
      closesAt: toReservationTime(FIXTURE_WINDOW.closesAt),
    },
    isClosed: false,
    availableBookingOptions: ['dinner'],
    slots: FIXTURE_SLOT_VALUES.map((value) => ({
      value: toReservationTime(value),
      display: value,
      periodId: null,
      periodName: 'Dinner',
      bookingOption: 'dinner',
      defaultBookingOption: 'dinner',
      availability: {
        services: {
          dinner: 'enabled',
          lunch: 'disabled',
        },
        labels: {
          kitchenClosed: false,
          lunchWindow: false,
          dinnerWindow: true,
        },
      },
      disabled: false,
    })),
    occasionCatalog: [],
  };
}

export function buildDevBookingFixtureCalendarMask({
  from,
  to,
}: {
  from: string;
  to: string;
}): CalendarMask {
  const reservation = getFixtureReservation();

  return {
    timezone: reservation.restaurantTimezone ?? 'Europe/London',
    from,
    to,
    closedDaysOfWeek: [],
    closedDates: [],
  };
}
