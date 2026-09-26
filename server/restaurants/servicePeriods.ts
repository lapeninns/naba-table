import { randomUUID } from 'crypto';

import { getOccasionCatalog } from '@/server/occasions/catalog';
import { canonicalTime, canonicalizeFromDb } from '@/server/restaurants/timeNormalization';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;
export type ServicePeriodReplacementRow = {
  id: string;
  restaurant_id: string;
  name: string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  booking_option: string;
};
type ReplacementRpcClient = DbClient & {
  rpc(
    fn: 'replace_restaurant_service_periods',
    args: { p_restaurant_id: string; p_rows: ServicePeriodReplacementRow[] },
  ): Promise<{ error: { message?: string } | null }>;
};

export type BookingOption = string;

export type ServicePeriod = {
  id: string;
  name: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  bookingOption: BookingOption;
  updatedAt: string | null;
};

export type UpdateServicePeriod = {
  id?: string;
  name: string;
  dayOfWeek?: number | null;
  startTime: string;
  endTime: string;
  bookingOption: BookingOption;
};

const OVERLAP_EXEMPT_BOOKING_OPTIONS = new Set<string>();

function normalizeDayOfWeek(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0 || value > 6) {
    throw new Error('dayOfWeek must be between 0-6 when provided');
  }
  return value;
}

function normalizeBookingOption(value: BookingOption | string | null | undefined): BookingOption {
  if (!value) {
    throw new Error('bookingOption is required');
  }
  return value.toString().trim().toLowerCase();
}

function validateServicePeriod(
  entry: UpdateServicePeriod,
  validOptions: Set<string>,
): ServicePeriod {
  const name = entry.name.trim();
  if (!name) {
    throw new Error('Service period name is required');
  }

  const dayOfWeek = normalizeDayOfWeek(entry.dayOfWeek ?? null);
  const startTime = canonicalTime(entry.startTime, `Service period "${name}" startTime`);
  const endTime = canonicalTime(entry.endTime, `Service period "${name}" endTime`);
  const bookingOption = normalizeBookingOption(entry.bookingOption);

  if (validOptions.size > 0 && !validOptions.has(bookingOption)) {
    throw new Error(`Invalid booking option "${entry.bookingOption}"`);
  }

  if (startTime >= endTime) {
    throw new Error(`Service period "${name}" must end after it starts`);
  }

  return {
    id: entry.id?.trim() || randomUUID(),
    name,
    dayOfWeek,
    startTime,
    endTime,
    bookingOption,
    updatedAt: null,
  };
}

function isOverlapExempt(bookingOption: BookingOption): boolean {
  return OVERLAP_EXEMPT_BOOKING_OPTIONS.has(bookingOption.trim().toLowerCase());
}

function canOverlap(first: ServicePeriod, second: ServicePeriod): boolean {
  return isOverlapExempt(first.bookingOption) || isOverlapExempt(second.bookingOption);
}

export function assertNoOverlappingPeriods(periods: ServicePeriod[]): void {
  const byDay = new Map<number | null, ServicePeriod[]>();
  periods.forEach((period) => {
    const key = period.dayOfWeek ?? null;
    const list = byDay.get(key) ?? [];
    list.push(period);
    byDay.set(key, list);
  });

  byDay.forEach((list, key) => {
    const sorted = [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let index = 1; index < sorted.length; index += 1) {
      const prev = sorted[index - 1];
      const current = sorted[index];
      if (prev.endTime > current.startTime && !canOverlap(prev, current)) {
        const label = key === null ? 'all days' : `day ${key}`;
        throw new Error(
          `Service periods overlap on ${label}: "${prev.name}" and "${current.name}"`,
        );
      }
    }
  });
}

export async function getServicePeriods(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<ServicePeriod[]> {
  const { data, error } = await client
    .from('restaurant_service_periods')
    .select('id, name, day_of_week, start_time, end_time, booking_option, updated_at')
    .eq('restaurant_id', restaurantId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    throw error;
  }

  const sorted = (data ?? []).sort((a, b) => {
    const dayA = a.day_of_week ?? 99;
    const dayB = b.day_of_week ?? 99;
    if (dayA !== dayB) return dayA - dayB;
    return (a.start_time ?? '').localeCompare(b.start_time ?? '');
  });

  return sorted.map((row) => ({
    id: row.id,
    name: row.name,
    dayOfWeek: row.day_of_week,
    startTime: canonicalizeFromDb(row.start_time) ?? row.start_time ?? '',
    endTime: canonicalizeFromDb(row.end_time) ?? row.end_time ?? '',
    bookingOption: normalizeBookingOption(row.booking_option as BookingOption),
    updatedAt: row.updated_at ?? null,
  }));
}

/**
 * Validates service periods and builds the rows `replace_restaurant_service_periods` (and the
 * availability command) replaces the restaurant's periods with. `validOptions` is the set of
 * booking-option keys a period may use; an empty set skips that check. Throws a plain Error on
 * invalid input.
 */
export function buildServicePeriodReplacementRows(
  restaurantId: string,
  periods: UpdateServicePeriod[],
  validOptions: Set<string>,
): ServicePeriodReplacementRow[] {
  const validated = periods.map((entry) => validateServicePeriod(entry, validOptions));
  const uniqueIds = new Set<string>();
  validated.forEach((period) => {
    if (uniqueIds.has(period.id)) {
      throw new Error(`Duplicate service period id ${period.id}`);
    }
    uniqueIds.add(period.id);
  });

  // Prevent overlapping periods for the same day (including null day) unless an overlap-exempt period is involved.
  assertNoOverlappingPeriods(validated);

  return validated.map((period) => ({
    id: period.id,
    restaurant_id: restaurantId,
    name: period.name,
    day_of_week: period.dayOfWeek,
    start_time: period.startTime,
    end_time: period.endTime,
    booking_option: period.bookingOption,
  }));
}

export async function updateServicePeriods(
  restaurantId: string,
  periods: UpdateServicePeriod[],
  client: DbClient = getServiceSupabaseClient(),
): Promise<ServicePeriod[]> {
  const catalog = await getOccasionCatalog({ client });
  const validOptions = new Set(
    catalog.definitions
      .map((definition) => definition.key.toLowerCase())
      .filter((key) => key !== 'drinks'),
  );
  const rows = buildServicePeriodReplacementRows(restaurantId, periods, validOptions);

  const { error: replaceError } = await (client as ReplacementRpcClient).rpc(
    'replace_restaurant_service_periods',
    {
      p_restaurant_id: restaurantId,
      p_rows: rows,
    },
  );

  if (replaceError) {
    throw replaceError;
  }

  return getServicePeriods(restaurantId, client);
}
