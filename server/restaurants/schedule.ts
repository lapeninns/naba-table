import { getTodayInTimezone } from '@/lib/utils/datetime';
import { getOccasionCatalog } from '@/server/occasions/catalog';
import { getServiceSupabaseClient } from '@/server/supabase';
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';
import { formatReservationTime } from '@reserve/shared/formatting/booking';
import { isOccasionAvailable, type OccasionCatalog, type OccasionDefinition, type OccasionKey } from '@reserve/shared/occasions';
import { normalizeTime, slotsForRange, toMinutes } from '@reserve/shared/time';

import type { Database } from '@/types/supabase';
import type { ReservationTime } from '@reserve/shared/time';
import type { SupabaseClient } from '@supabase/supabase-js';

type PublicSchema = Database['public'];
type DbClient = SupabaseClient<Database, 'public', 'public', PublicSchema>;
type ServiceState = 'enabled' | 'disabled';
type CoverageRange = { start: number; end: number };
type OptionCoverage = Map<OccasionKey, CoverageRange[]>;

export type ServiceAvailability = {
  services: Record<OccasionKey, ServiceState>;
  labels: {
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
  reservation_interval_minutes: number | null;
  reservation_slot_times: string[] | null;
};

const ALLOWED_BOOKING_OPTIONS = new Set<OccasionKey>(['lunch', 'dinner']);
const DEFAULT_BOOKING_OPTION: OccasionKey = 'lunch';

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

function resolveMonth(date: string, timezone: string): number {
  try {
    const base = new Date(`${date}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      timeZone: timezone,
    });
    const month = Number.parseInt(formatter.format(base), 10);
    if (Number.isFinite(month)) {
      return month;
    }
  } catch (error) {
    console.warn('[schedule] failed to resolve month', { date, timezone, error });
  }
  const fallback = new Date(`${date}T00:00:00`);
  return fallback.getMonth() + 1;
}

function normalizeMaybeTime(value: string | null | undefined): ReservationTime | null {
  const normalized = normalizeTime(value ?? null);
  return normalized;
}

function normalizeSlotTimes(value: string[] | null | undefined): ReservationTime[] {
  if (!value || value.length === 0) {
    return [];
  }
  const seen = new Set<number>();
  const slots: Array<{ minutes: number; value: ReservationTime }> = [];
  value.forEach((entry) => {
    const normalized = normalizeTime(entry);
    if (!normalized) {
      return;
    }
    const minutes = toMinutes(normalized);
    if (seen.has(minutes)) {
      return;
    }
    seen.add(minutes);
    slots.push({ minutes, value: normalized });
  });
  slots.sort((a, b) => a.minutes - b.minutes);
  return slots.map((slot) => slot.value);
}

function resolveIntervalMinutes(
  overrideInterval: number | null | undefined,
  weeklyInterval: number | null | undefined,
  fallback: number,
): number {
  if (typeof overrideInterval === 'number' && overrideInterval > 0) {
    return overrideInterval;
  }
  if (typeof weeklyInterval === 'number' && weeklyInterval > 0) {
    return weeklyInterval;
  }
  return fallback > 0 ? fallback : 15;
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
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    if (endMinutes <= startMinutes) {
      return;
    }
    const option = pickBookingOption(period);
    if (!ALLOWED_BOOKING_OPTIONS.has(option)) {
      return;
    }
    const ranges = coverage.get(option) ?? [];
    ranges.push({
      start: startMinutes,
      end: endMinutes,
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
  coverage: OptionCoverage;
  slot: ReservationTime;
  orderedKeys: OccasionKey[];
  catalog: OccasionCatalog;
  date: string;
  timezone: string;
  month: number;
};

function buildAvailability({
  primaryOption,
  coverage,
  slot,
  orderedKeys,
  catalog,
  date,
  timezone,
  month,
}: AvailabilityParams): ServiceAvailability {
  const keys = Array.from(
    new Set<OccasionKey>([...orderedKeys, ...coverage.keys(), primaryOption]),
  ).filter((key) => ALLOWED_BOOKING_OPTIONS.has(key));
  const services: Record<OccasionKey, ServiceState> = {};

  keys.forEach((key) => {
    let enabled = hasCoverage(coverage, key, slot);
    if (enabled) {
      const definition = catalog.byKey.get(key);
      if (definition) {
        enabled = isOccasionAvailable(definition, { date, time: slot, timezone, month });
      }
    }
    services[key] = enabled ? 'enabled' : 'disabled';
  });

  const lunchState = services['lunch'] ?? 'disabled';
  const dinnerState = services['dinner'] ?? 'disabled';
  const kitchenClosed = lunchState === 'disabled' && dinnerState === 'disabled';

  return {
    services,
    labels: {
      kitchenClosed,
      lunchWindow: lunchState === 'enabled',
      dinnerWindow: dinnerState === 'enabled',
    },
  };
}

function pickBookingOption(period?: RawServicePeriod | null): OccasionKey {
  const raw = period?.booking_option;
  if (!raw) {
    return DEFAULT_BOOKING_OPTION;
  }
  const trimmed = raw.toString().trim().toLowerCase();
  return (trimmed.length > 0 ? trimmed : DEFAULT_BOOKING_OPTION) as OccasionKey;
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
  month: number,
  fixedSlots: ReservationTime[] | null,
): RestaurantScheduleSlot[] {
  if (!opensAt || !closesAt || toMinutes(closesAt) <= toMinutes(opensAt)) {
    return [];
  }

  const optionPriority = new Map<OccasionKey, number>();
  orderedKeys.forEach((key, index) => optionPriority.set(key, index));

  type PeriodDetail = {
    period: RawServicePeriod;
    option: OccasionKey;
    isDaySpecific: boolean;
    startMinutes: number;
    endMinutes: number;
    durationMinutes: number;
    fallbackBias: number;
    optionOrder: number;
  };

  const periodDetails = periods.reduce<PeriodDetail[]>((acc, period) => {
    const start = normalizeMaybeTime(period.start_time);
    const end = normalizeMaybeTime(period.end_time);
    if (!start || !end) {
      return acc;
    }
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    if (endMinutes <= startMinutes) {
      return acc;
    }
    const option = pickBookingOption(period);
    if (!ALLOWED_BOOKING_OPTIONS.has(option)) {
      return acc;
    }
    acc.push({
      period,
      option,
      isDaySpecific: period.day_of_week === dayOfWeek,
      startMinutes,
      endMinutes,
      durationMinutes: endMinutes - startMinutes,
      fallbackBias: 0,
      optionOrder: optionPriority.get(option) ?? optionPriority.size,
    });
    return acc;
  }, []);

  if (periodDetails.length === 0) {
    return [];
  }

  const findPeriodForTime = (value: ReservationTime) => {
    const slotMinutes = toMinutes(value);
    const matches = periodDetails.filter(
      (entry) => slotMinutes >= entry.startMinutes && slotMinutes < entry.endMinutes,
    );
    if (matches.length === 0) {
      return null;
    }

    matches.sort((a, b) => {
      if (a.isDaySpecific !== b.isDaySpecific) {
        return a.isDaySpecific ? -1 : 1;
      }
      if (a.durationMinutes !== b.durationMinutes) {
        return a.durationMinutes - b.durationMinutes;
      }
      if (a.fallbackBias !== b.fallbackBias) {
        return a.fallbackBias - b.fallbackBias;
      }
      if (a.optionOrder !== b.optionOrder) {
        return a.optionOrder - b.optionOrder;
      }
      if (a.startMinutes !== b.startMinutes) {
        return a.startMinutes - b.startMinutes;
      }
      return (a.period.name ?? '').localeCompare(b.period.name ?? '');
    });

    return matches[0]?.period ?? null;
  };

  const openingMinutes = toMinutes(opensAt);
  const closingMinutes = closesAt ? toMinutes(closesAt) : null;
  const baseSlots =
    fixedSlots && fixedSlots.length > 0
      ? fixedSlots.filter((slot) => {
          const minutes = toMinutes(slot);
          if (minutes < openingMinutes) {
            return false;
          }
          if (closingMinutes !== null && minutes >= closingMinutes) {
            return false;
          }
          return true;
        })
      : slotsForRange(opensAt, closesAt, intervalMinutes);

  return baseSlots.reduce<RestaurantScheduleSlot[]>((acc, slot) => {
    const period = findPeriodForTime(slot);
    if (!period) {
      return acc;
    }
    const resolvedOption = pickBookingOption(period);
    const bookingOption = ALLOWED_BOOKING_OPTIONS.has(resolvedOption)
      ? resolvedOption
      : DEFAULT_BOOKING_OPTION;
    const availability = buildAvailability({
      primaryOption: bookingOption,
      coverage,
      slot,
      orderedKeys,
      catalog,
      date,
      timezone,
      month,
    });
    const defaultBookingOption = bookingOption;
    const optionDefinition = catalog.byKey.get(bookingOption);
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

  const intervalMinutes =
    restaurant.reservation_interval_minutes ?? DEFAULT_RESERVATION_INTERVAL_MINUTES;
  const defaultDurationMinutes = restaurant.reservation_default_duration_minutes ?? 90;
  const lastSeatingBufferMinutes =
    restaurant.reservation_last_seating_buffer_minutes ?? defaultDurationMinutes;
  const date = sanitizeDate(options.date, restaurant.timezone);
  const dayOfWeek = resolveDayOfWeek(date, restaurant.timezone);
  const month = resolveMonth(date, restaurant.timezone);

  const [{ data: overrideRow, error: overrideError }, { data: weeklyRow, error: weeklyError }, { data: periods, error: periodsError }] =
    await Promise.all([
      client
        .from('restaurant_operating_hours')
        .select('opens_at, closes_at, is_closed, reservation_interval_minutes, reservation_slot_times')
        .eq('restaurant_id', restaurantId)
        .eq('effective_date', date)
        .maybeSingle(),
      client
        .from('restaurant_operating_hours')
        .select('opens_at, closes_at, is_closed, reservation_interval_minutes, reservation_slot_times')
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
  const effectiveIntervalMinutes = resolveIntervalMinutes(
    overrideRow?.reservation_interval_minutes,
    weeklyRow?.reservation_interval_minutes,
    intervalMinutes,
  );
  const overrideSlotTimes = normalizeSlotTimes(overrideRow?.reservation_slot_times);
  const weeklySlotTimes = normalizeSlotTimes(weeklyRow?.reservation_slot_times);
  const effectiveSlotTimes = overrideSlotTimes.length > 0 ? overrideSlotTimes : weeklySlotTimes;

  const relevantPeriods = (periods ?? []).filter((period): period is RawServicePeriod =>
    Boolean(period) && Boolean(period.start_time) && Boolean(period.end_time) && isPeriodActiveForDay(period, dayOfWeek),
  );
  const coverage = buildCoverage(relevantPeriods);
  // Prefer provided client for catalog lookups; fall back to service client if none was passed.
  const catalogClient = options.client ?? getServiceSupabaseClient();
  const catalog = await getOccasionCatalog({ client: catalogClient, disableServiceRetry: true });
  const orderedKeys = ['lunch', 'dinner'].filter((key) =>
    ALLOWED_BOOKING_OPTIONS.has(key as OccasionKey),
  ) as OccasionKey[];

  const slots = isClosed
    ? []
    : computeSlots(
      opensAt,
      closesAt,
      effectiveIntervalMinutes,
      relevantPeriods,
      dayOfWeek,
      coverage,
      orderedKeys,
      catalog,
      date,
      restaurant.timezone,
      month,
      effectiveSlotTimes.length > 0 ? effectiveSlotTimes : null,
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
    intervalMinutes: effectiveIntervalMinutes,
    defaultDurationMinutes,
    window: {
      opensAt: opensAt,
      closesAt: closesAt,
    },
    isClosed,
    availableBookingOptions,
    slots,
    occasionCatalog: catalog.definitions.filter((definition) =>
      ALLOWED_BOOKING_OPTIONS.has(definition.key),
    ),
    lastSeatingBufferMinutes,
  };
}
