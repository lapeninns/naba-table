import { getServiceSupabaseClient } from '@/server/supabase';
import type { Database } from '@/types/supabase';
import { getTodayInTimezone } from '@/lib/utils/datetime';

import { formatReservationTime } from '@reserve/shared/formatting/booking';
import type { BookingOption } from '@reserve/shared/booking';
import { normalizeTime, slotsForRange, toMinutes } from '@reserve/shared/time';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReservationTime } from '@reserve/shared/time';

type DbClient = SupabaseClient<Database, 'public', any>;
type ServiceState = 'enabled' | 'disabled';

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

export type RestaurantScheduleSlot = {
  value: ReservationTime;
  display: string;
  periodId: string | null;
  periodName: string | null;
  bookingOption: BookingOption;
  defaultBookingOption: BookingOption;
  availability: ServiceAvailability;
  disabled: boolean;
};

export type RestaurantSchedule = {
  restaurantId: string;
  date: string;
  timezone: string;
  intervalMinutes: number;
  defaultDurationMinutes: number;
  window: {
    opensAt: ReservationTime | null;
    closesAt: ReservationTime | null;
  };
  isClosed: boolean;
  slots: RestaurantScheduleSlot[];
};

type ScheduleOptions = {
  date?: string;
  client?: DbClient;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

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
};

const DEFAULT_OPTION_LABELS: Record<BookingOption, string> = {
  lunch: 'Lunch',
  dinner: 'Dinner',
  drinks: 'Drinks & cocktails',
};

function sanitizeDate(input: string | undefined, timezone: string): string {
  if (input && DATE_REGEX.test(input)) {
    return input;
  }
  return getTodayInTimezone(timezone);
}

function resolveDayOfWeek(date: string, timezone: string): number {
  try {
    const base = new Date(`${date}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: timezone,
    });
    const weekday = formatter.format(base).toLowerCase();
    if (weekday in WEEKDAY_MAP) {
      return WEEKDAY_MAP[weekday];
    }
  } catch (error) {
    console.warn('[schedule] failed to resolve weekday', { date, timezone, error });
  }
  const fallback = new Date(`${date}T00:00:00`);
  return Number.isNaN(fallback.getDay()) ? 0 : fallback.getDay();
}

function normalizeMaybeTime(value: string | null | undefined): ReservationTime | null {
  const normalized = normalizeTime(value ?? null);
  return normalized;
}

function isPeriodActiveForDay(period: RawServicePeriod, dayOfWeek: number): boolean {
  return period.day_of_week === null || period.day_of_week === dayOfWeek;
}

function buildAvailability(option: BookingOption, isOpen: boolean, periodName: string | null): ServiceAvailability {
  const services: Record<BookingOption, ServiceState> = {
    lunch: option === 'lunch' ? 'enabled' : 'disabled',
    dinner: option === 'dinner' ? 'enabled' : 'disabled',
    drinks: isOpen ? 'enabled' : 'disabled',
  };

  const drinksOnly = services.drinks === 'enabled' && services.lunch === 'disabled' && services.dinner === 'disabled';
  const normalizedName = periodName?.toLowerCase() ?? '';

  return {
    services,
    labels: {
      happyHour: /happy\s*hour/.test(normalizedName),
      drinksOnly,
      kitchenClosed: drinksOnly,
      lunchWindow: services.lunch === 'enabled',
      dinnerWindow: services.dinner === 'enabled',
    },
  };
}

function pickBookingOption(period?: RawServicePeriod | null): BookingOption {
  const raw = period?.booking_option?.toLowerCase();
  if (raw === 'lunch' || raw === 'dinner' || raw === 'drinks') {
    return raw;
  }
  return 'drinks';
}

function computeSlots(
  opensAt: ReservationTime | null,
  closesAt: ReservationTime | null,
  intervalMinutes: number,
  periods: RawServicePeriod[],
  dayOfWeek: number,
): RestaurantScheduleSlot[] {
  if (!opensAt || !closesAt || toMinutes(closesAt) <= toMinutes(opensAt)) {
    return [];
  }

  const daySpecific = periods.filter((period) => period.day_of_week === dayOfWeek);
  const allDays = periods.filter((period) => period.day_of_week === null);

  const findPeriodForTime = (value: ReservationTime) => {
    const inRange = (period: RawServicePeriod) =>
      value >= (normalizeMaybeTime(period.start_time) ?? value) &&
      value < (normalizeMaybeTime(period.end_time) ?? value);

    const specific = daySpecific.find(inRange);
    if (specific) return specific;
    return allDays.find(inRange);
  };

  const baseSlots = slotsForRange(opensAt, closesAt, intervalMinutes);
  return baseSlots.map((slot) => {
    const period = findPeriodForTime(slot);
    const bookingOption = pickBookingOption(period);
    const availability = buildAvailability(bookingOption, true, period?.name ?? null);
    const defaultBookingOption = bookingOption;
    const disabled = availability.services[defaultBookingOption] === 'disabled';
    const label =
      period?.name?.trim() ??
      DEFAULT_OPTION_LABELS[bookingOption] ??
      bookingOption.replace(/\b\w/g, (char) => char.toUpperCase());

    return {
      value: slot,
      display: formatReservationTime(slot),
      periodId: period?.id ?? null,
      periodName: label,
      bookingOption,
      defaultBookingOption,
      availability,
      disabled,
    };
  });
}

export async function getRestaurantSchedule(
  restaurantId: string,
  options: ScheduleOptions = {},
): Promise<RestaurantSchedule> {
  const client = options.client ?? getServiceSupabaseClient();

  const { data: restaurant, error: restaurantError } = await client
    .from('restaurants')
    .select(
      'id, timezone, reservation_interval_minutes, reservation_default_duration_minutes',
    )
    .eq('id', restaurantId)
    .maybeSingle();

  if (restaurantError) {
    throw restaurantError;
  }

  if (!restaurant) {
    throw new Error('Restaurant not found');
  }

  const intervalMinutes = restaurant.reservation_interval_minutes ?? 15;
  const defaultDurationMinutes = restaurant.reservation_default_duration_minutes ?? 90;
  const date = sanitizeDate(options.date, restaurant.timezone);
  const dayOfWeek = resolveDayOfWeek(date, restaurant.timezone);

  const [{ data: overrideRow, error: overrideError }, { data: weeklyRow, error: weeklyError }, { data: periods, error: periodsError }] =
    await Promise.all([
      client
        .from('restaurant_operating_hours')
        .select('opens_at, closes_at, is_closed')
        .eq('restaurant_id', restaurantId)
        .eq('effective_date', date)
        .maybeSingle(),
      client
        .from('restaurant_operating_hours')
        .select('opens_at, closes_at, is_closed')
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

  const effectiveHours: RawOperatingHours | null = overrideRow ?? weeklyRow ?? null;
  const opensAt = normalizeMaybeTime(effectiveHours?.opens_at);
  const closesAt = normalizeMaybeTime(effectiveHours?.closes_at);
  const closedFlag = Boolean(effectiveHours?.is_closed);
  const isClosed = closedFlag || !opensAt || !closesAt || toMinutes(closesAt) <= toMinutes(opensAt);

  const relevantPeriods = (periods ?? []).filter((period): period is RawServicePeriod =>
    Boolean(period) && Boolean(period.start_time) && Boolean(period.end_time) && isPeriodActiveForDay(period, dayOfWeek),
  );

  const slots = isClosed
    ? []
    : computeSlots(opensAt, closesAt, intervalMinutes, relevantPeriods, dayOfWeek);

  return {
    restaurantId: restaurant.id,
    date,
    timezone: restaurant.timezone,
    intervalMinutes,
    defaultDurationMinutes,
    window: {
      opensAt: opensAt,
      closesAt: closesAt,
    },
    isClosed,
    slots,
  };
}
