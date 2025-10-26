import { getTodayInTimezone } from '@/lib/utils/datetime';
import { getOccasionCatalog } from '@/server/occasions/catalog';
import { getServiceSupabaseClient } from '@/server/supabase';
import { formatReservationTime } from '@reserve/shared/formatting/booking';
import { isOccasionAvailable, type OccasionCatalog, type OccasionDefinition, type OccasionKey } from '@reserve/shared/occasions';
import { normalizeTime, slotsForRange, toMinutes } from '@reserve/shared/time';

import type { Database } from '@/types/supabase';
import type { ReservationTime } from '@reserve/shared/time';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database, 'public', any>;
type ServiceState = 'enabled' | 'disabled';
type CoverageRange = { start: number; end: number };
type OptionCoverage = Map<OccasionKey, CoverageRange[]>;

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

export type RestaurantScheduleSlot = {
  value: ReservationTime;
  display: string;
  periodId: string | null;
  periodName: string | null;
  bookingOption: OccasionKey;
  defaultBookingOption: OccasionKey;
  availability: ServiceAvailability;
  disabled: boolean;
};

export type RestaurantSchedule = {
  restaurantId: string;
  date: string;
  timezone: string;
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

function buildCoverage(periods: RawServicePeriod[]): OptionCoverage {
  const coverage: OptionCoverage = new Map();
  periods.forEach((period) => {
    const start = normalizeMaybeTime(period.start_time);
    const end = normalizeMaybeTime(period.end_time);
    if (!start || !end) {
      return;
    }
    const option = pickBookingOption(period);
    const ranges = coverage.get(option) ?? [];
    ranges.push({
      start: toMinutes(start),
      end: toMinutes(end),
    });
    coverage.set(option, ranges);
  });
  return coverage;
}

function hasCoverage(coverage: OptionCoverage, option: OccasionKey, slot: ReservationTime): boolean {
  const ranges = coverage.get(option);
  if (!ranges || ranges.length === 0) {
    return false;
  }
  const minutes = toMinutes(slot);
  return ranges.some(({ start, end }) => minutes >= start && minutes < end);
}

type AvailabilityParams = {
  primaryOption: OccasionKey;
  periodName: string | null;
  coverage: OptionCoverage;
  slot: ReservationTime;
  orderedKeys: OccasionKey[];
  catalog: OccasionCatalog;
  date: string;
  timezone: string;
};

function buildAvailability({
  primaryOption,
  periodName,
  coverage,
  slot,
  orderedKeys,
  catalog,
  date,
  timezone,
}: AvailabilityParams): ServiceAvailability {
  const keys = Array.from(new Set<OccasionKey>([...orderedKeys, ...coverage.keys(), primaryOption]));
  const services: Record<OccasionKey, ServiceState> = {};

  keys.forEach((key) => {
    let enabled = hasCoverage(coverage, key, slot);
    if (enabled) {
      const definition = catalog.byKey.get(key);
      if (definition) {
        enabled = isOccasionAvailable(definition, { date, time: slot, timezone });
      }
    }
    services[key] = enabled ? 'enabled' : 'disabled';
  });

  if (Object.values(services).every((state) => state === 'disabled')) {
    services[primaryOption] = 'enabled';
  }

  const normalizedName = periodName?.toLowerCase() ?? '';
  const lunchState = services['lunch'] ?? 'disabled';
  const dinnerState = services['dinner'] ?? 'disabled';
  const drinksState = services['drinks'] ?? 'disabled';
  const drinksOnly = drinksState === 'enabled' && lunchState === 'disabled' && dinnerState === 'disabled';

  return {
    services,
    labels: {
      happyHour: /happy\s*hour/.test(normalizedName),
      drinksOnly,
      kitchenClosed: drinksOnly,
      lunchWindow: lunchState === 'enabled',
      dinnerWindow: dinnerState === 'enabled',
    },
  };
}

function pickBookingOption(period?: RawServicePeriod | null): OccasionKey {
  const raw = period?.booking_option;
  if (!raw) {
    return 'drinks';
  }
  const trimmed = raw.toString().trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : 'drinks';
}

function computeSlots(
  opensAt: ReservationTime | null,
  closesAt: ReservationTime | null,
  intervalMinutes: number,
  periods: RawServicePeriod[],
  dayOfWeek: number,
  coverage: OptionCoverage,
  orderedKeys: OccasionKey[],
  catalog: OccasionCatalog,
  date: string,
  timezone: string,
  defaultDurationMinutes: number,
  lastSeatingBufferMinutes: number,
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
  const closingMinutes = closesAt ? toMinutes(closesAt) : null;

  return baseSlots.reduce<RestaurantScheduleSlot[]>((acc, slot) => {
    const period = findPeriodForTime(slot);
    const bookingOption = pickBookingOption(period);
    const availability = buildAvailability({
      primaryOption: bookingOption,
      periodName: period?.name ?? null,
      coverage,
      slot,
      orderedKeys,
      catalog,
      date,
      timezone,
    });
    const defaultBookingOption = bookingOption;
    const optionDefinition = catalog.byKey.get(bookingOption);
    const optionDuration = optionDefinition?.defaultDurationMinutes ?? defaultDurationMinutes;
    const guardMinutes = Math.max(lastSeatingBufferMinutes, optionDuration);
    const slotMinutes = toMinutes(slot);
    const exceedsClosing =
      closingMinutes !== null ? slotMinutes + guardMinutes > closingMinutes : false;

    if (exceedsClosing) {
      return acc;
    }

    const disabled = availability.services[defaultBookingOption] === 'disabled';
    const label =
      period?.name?.trim() ??
      optionDefinition?.label ??
      bookingOption.replace(/\b\w/g, (char) => char.toUpperCase());

    acc.push({
      value: slot,
      display: formatReservationTime(slot),
      periodId: period?.id ?? null,
      periodName: label,
      bookingOption,
      defaultBookingOption,
      availability,
      disabled,
    });

    return acc;
  }, []);
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

  const intervalMinutes = restaurant.reservation_interval_minutes ?? 15;
  const defaultDurationMinutes = restaurant.reservation_default_duration_minutes ?? 90;
  const lastSeatingBufferMinutes =
    restaurant.reservation_last_seating_buffer_minutes ?? defaultDurationMinutes;
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
  const coverage = buildCoverage(relevantPeriods);
  const catalog = await getOccasionCatalog({ client });
  const orderedKeys = Array.from(new Set<OccasionKey>([...catalog.orderedKeys, ...coverage.keys()]));

  const slots = isClosed
    ? []
    : computeSlots(
        opensAt,
        closesAt,
        intervalMinutes,
        relevantPeriods,
        dayOfWeek,
        coverage,
        orderedKeys,
        catalog,
        date,
        restaurant.timezone,
        defaultDurationMinutes,
        lastSeatingBufferMinutes,
      );

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
    intervalMinutes,
    defaultDurationMinutes,
    window: {
      opensAt: opensAt,
      closesAt: closesAt,
    },
    isClosed,
    availableBookingOptions,
    slots,
    occasionCatalog: catalog.definitions,
    lastSeatingBufferMinutes,
  };
}
