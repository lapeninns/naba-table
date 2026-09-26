import {
  GUEST_SCHEDULE_BOOKING_OPTIONS,
  computeScheduleSlots,
  filterServicePeriodsForDay,
  resolveEffectiveScheduleHours,
  resolveScheduleDayOfWeek,
  resolveScheduleMonth,
  type RestaurantScheduleSlot,
  type ScheduleHoursRow,
  type ScheduleServicePeriod,
} from '@/lib/restaurants/guest-schedule/slots';
import { getTodayInTimezone } from '@/lib/utils/datetime';
import { getOccasionCatalog } from '@/server/occasions/catalog';
import { getServiceSupabaseClient } from '@/server/supabase';
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

import type { Database } from '@/types/supabase';
import type { OccasionDefinition, OccasionKey } from '@reserve/shared/occasions';
import type { ReservationTime } from '@reserve/shared/time';
import type { SupabaseClient } from '@supabase/supabase-js';

export type {
  RestaurantScheduleSlot,
  ServiceAvailability,
} from '@/lib/restaurants/guest-schedule/slots';

type PublicSchema = Database['public'];
type DbClient = SupabaseClient<Database, 'public', 'public', PublicSchema>;

export type RestaurantSchedule = {
  restaurantId: string;
  date: string;
  timezone: string;
  notes: string | null;
  intervalMinutes: number;
  defaultDurationMinutes: number;
  lastSeatingBufferMinutes: number;
  window: {
    opensAt: ReservationTime | null;
    closesAt: ReservationTime | null;
  };
  isClosed: boolean;
  availableBookingOptions: OccasionKey[];
  slots: RestaurantScheduleSlot[];
  occasionCatalog: OccasionDefinition[];
};

type ScheduleOptions = {
  date?: string;
  client?: DbClient;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type RawServicePeriod = {
  id: string;
  name: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  booking_option: string;
};

type RawOperatingHours = {
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean | null;
  notes: string | null;
  reservation_interval_minutes: number | null;
  reservation_slot_times: string[] | null;
};

function sanitizeDate(input: string | undefined, timezone: string): string {
  if (input && DATE_REGEX.test(input)) {
    return input;
  }
  return getTodayInTimezone(timezone);
}

function toScheduleHoursRow(row: RawOperatingHours | null): ScheduleHoursRow | null {
  if (!row) {
    return null;
  }
  return {
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    isClosed: row.is_closed,
    notes: row.notes,
    reservationIntervalMinutes: row.reservation_interval_minutes,
    reservationSlotTimes: row.reservation_slot_times,
  };
}

function toScheduleServicePeriod(row: RawServicePeriod): ScheduleServicePeriod {
  return {
    id: row.id,
    name: row.name,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    bookingOption: row.booking_option,
  };
}

export async function getRestaurantSchedule(
  restaurantId: string,
  options: ScheduleOptions = {},
): Promise<RestaurantSchedule> {
  const client = options.client ?? getServiceSupabaseClient();

  const { data: restaurant, error: restaurantError } = await client
    .from('restaurants')
    .select(
      'id, timezone, reservation_interval_minutes, reservation_default_duration_minutes, reservation_last_seating_buffer_minutes',
    )
    .eq('id', restaurantId)
    .maybeSingle();

  if (restaurantError) {
    throw restaurantError;
  }

  if (!restaurant) {
    throw new Error('Restaurant not found');
  }

  const intervalMinutes =
    restaurant.reservation_interval_minutes ?? DEFAULT_RESERVATION_INTERVAL_MINUTES;
  const defaultDurationMinutes = restaurant.reservation_default_duration_minutes ?? 90;
  const lastSeatingBufferMinutes =
    restaurant.reservation_last_seating_buffer_minutes ?? defaultDurationMinutes;
  const date = sanitizeDate(options.date, restaurant.timezone);
  const dayOfWeek = resolveScheduleDayOfWeek(date, restaurant.timezone);
  const month = resolveScheduleMonth(date, restaurant.timezone);

  const [
    { data: overrideRow, error: overrideError },
    { data: weeklyRow, error: weeklyError },
    { data: periods, error: periodsError },
  ] = await Promise.all([
    client
      .from('restaurant_operating_hours')
      .select(
        'opens_at, closes_at, is_closed, notes, reservation_interval_minutes, reservation_slot_times',
      )
      .eq('restaurant_id', restaurantId)
      .eq('effective_date', date)
      .maybeSingle(),
    client
      .from('restaurant_operating_hours')
      .select(
        'opens_at, closes_at, is_closed, notes, reservation_interval_minutes, reservation_slot_times',
      )
      .eq('restaurant_id', restaurantId)
      .eq('day_of_week', dayOfWeek)
      .is('effective_date', null)
      .maybeSingle(),
    client
      .from('restaurant_service_periods')
      .select('id, name, day_of_week, start_time, end_time, booking_option')
      .eq('restaurant_id', restaurantId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true }),
  ]);

  if (overrideError) {
    throw overrideError;
  }
  if (weeklyError) {
    throw weeklyError;
  }
  if (periodsError) {
    throw periodsError;
  }

  const effectiveHours = resolveEffectiveScheduleHours({
    overrideRow: toScheduleHoursRow(overrideRow),
    weeklyRow: toScheduleHoursRow(weeklyRow),
    restaurantIntervalMinutes: intervalMinutes,
  });

  const relevantPeriods = filterServicePeriodsForDay(
    (periods ?? []).filter(Boolean).map(toScheduleServicePeriod),
    dayOfWeek,
  );
  // Prefer provided client for catalog lookups; fall back to service client if none was passed.
  const catalogClient = options.client ?? getServiceSupabaseClient();
  const catalog = await getOccasionCatalog({ client: catalogClient, disableServiceRetry: true });
  const orderedKeys = [...GUEST_SCHEDULE_BOOKING_OPTIONS];

  const slots = effectiveHours.isClosed
    ? []
    : computeScheduleSlots({
        opensAt: effectiveHours.opensAt,
        closesAt: effectiveHours.closesAt,
        intervalMinutes: effectiveHours.intervalMinutes,
        periods: relevantPeriods,
        dayOfWeek,
        catalog,
        date,
        timezone: restaurant.timezone,
        month,
        fixedSlots: effectiveHours.fixedSlotTimes,
      });

  const availableOptionsSet = new Set<OccasionKey>();
  slots.forEach((slot) => {
    Object.entries(slot.availability.services).forEach(([key, state]) => {
      if (state === 'enabled') {
        availableOptionsSet.add(key as OccasionKey);
      }
    });
  });

  let availableBookingOptions = orderedKeys.filter((key) => availableOptionsSet.has(key));
  if (availableBookingOptions.length === 0 && slots.length > 0) {
    slots.forEach((slot) => availableOptionsSet.add(slot.bookingOption));
    availableBookingOptions = orderedKeys.filter((key) => availableOptionsSet.has(key));
  }

  return {
    restaurantId: restaurant.id,
    date,
    timezone: restaurant.timezone,
    notes: effectiveHours.notes,
    intervalMinutes: effectiveHours.intervalMinutes,
    defaultDurationMinutes,
    window: {
      opensAt: effectiveHours.opensAt,
      closesAt: effectiveHours.closesAt,
    },
    isClosed: effectiveHours.isClosed,
    availableBookingOptions,
    slots,
    occasionCatalog: catalog.definitions.filter((definition) =>
      GUEST_SCHEDULE_BOOKING_OPTIONS.includes(definition.key),
    ),
    lastSeatingBufferMinutes,
  };
}
