import { randomUUID } from 'crypto';


import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import {
  canonicalOptionalTime,
  canonicalTime,
  canonicalizeFromDb,
} from '@/server/restaurants/timeNormalization';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database, 'public'>;
type OperatingHoursInsert = Database['public']['Tables']['restaurant_operating_hours']['Insert'];

export type WeeklyOperatingHour = {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  notes: string | null;
  reservationIntervalMinutes: number | null;
  reservationSlotTimes: string[] | null;
};

export type OperatingHourOverride = {
  id: string;
  effectiveDate: string;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  notes: string | null;
  reservationIntervalMinutes: number | null;
  reservationSlotTimes: string[] | null;
};

export type OperatingHoursSnapshot = {
  restaurantId: string;
  timezone: string;
  weekly: WeeklyOperatingHour[];
  overrides: OperatingHourOverride[];
};

export type UpdateWeeklyOperatingHour = {
  dayOfWeek: number;
  opensAt?: string | null;
  closesAt?: string | null;
  isClosed?: boolean;
  notes?: string | null;
  reservationIntervalMinutes?: number | null;
  reservationSlotTimes?: string[] | null;
};

export type UpdateOperatingHourOverride = {
  id?: string;
  effectiveDate: string;
  opensAt?: string | null;
  closesAt?: string | null;
  isClosed?: boolean;
  notes?: string | null;
  reservationIntervalMinutes?: number | null;
  reservationSlotTimes?: string[] | null;
};

export type UpdateOperatingHoursPayload = {
  weekly: UpdateWeeklyOperatingHour[];
  overrides: UpdateOperatingHourOverride[];
};

const DAYS_IN_WEEK = 7;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function ensureOpenBeforeClose(opensAt: string | null, closesAt: string | null, context: string) {
  if (!opensAt || !closesAt) {
    throw new Error(`${context}: opensAt and closesAt must be provided when not closed`);
  }

  if (opensAt >= closesAt) {
    throw new Error(`${context}: closesAt must be after opensAt`);
  }
}

function normalizeInterval(value: number | null | undefined, context: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${context}: interval must be a whole number`);
  }
  if (value < RESERVATION_INTERVAL_MIN || value > RESERVATION_INTERVAL_MAX) {
    throw new Error(
      `${context}: interval must be between ${RESERVATION_INTERVAL_MIN}-${RESERVATION_INTERVAL_MAX}`,
    );
  }
  return value;
}

function normalizeSlotTimes(
  value: string[] | null | undefined,
  context: string,
): string[] | null {
  if (!value || value.length === 0) {
    return null;
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const time = canonicalTime(entry, `${context}: slotTimes[${index}]`);
    if (!seen.has(time)) {
      seen.add(time);
      normalized.push(time);
    }
  });
  return normalized.length > 0 ? normalized : null;
}

function normalizeSlotTimesFromDb(value: string[] | null | undefined): string[] | null {
  if (!value || value.length === 0) {
    return null;
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  value.forEach((entry) => {
    const time = canonicalizeFromDb(entry);
    if (!time || !time.trim()) {
      return;
    }
    if (!seen.has(time)) {
      seen.add(time);
      normalized.push(time);
    }
  });
  return normalized.length > 0 ? normalized : null;
}

function validateWeeklyEntry(entry: UpdateWeeklyOperatingHour): WeeklyOperatingHour {
  if (!Number.isInteger(entry.dayOfWeek) || entry.dayOfWeek < 0 || entry.dayOfWeek >= DAYS_IN_WEEK) {
    throw new Error(`Weekly entry dayOfWeek must be between 0-6`);
  }

  const isClosed = entry.isClosed ?? false;
  const opensAt = canonicalOptionalTime(entry.opensAt ?? null, `Weekly day ${entry.dayOfWeek} opensAt`);
  const closesAt = canonicalOptionalTime(entry.closesAt ?? null, `Weekly day ${entry.dayOfWeek} closesAt`);
  const reservationIntervalMinutes = normalizeInterval(
    entry.reservationIntervalMinutes ?? null,
    `Weekly day ${entry.dayOfWeek} reservationIntervalMinutes`,
  );
  const reservationSlotTimes = normalizeSlotTimes(
    entry.reservationSlotTimes ?? null,
    `Weekly day ${entry.dayOfWeek} reservationSlotTimes`,
  );

  if (isClosed) {
    return {
      dayOfWeek: entry.dayOfWeek,
      opensAt: null,
      closesAt: null,
      isClosed: true,
      notes: entry.notes?.trim() ?? null,
      reservationIntervalMinutes: null,
      reservationSlotTimes: null,
    };
  }

  ensureOpenBeforeClose(opensAt, closesAt, `Weekly day ${entry.dayOfWeek}`);

  return {
    dayOfWeek: entry.dayOfWeek,
    opensAt: opensAt!,
    closesAt: closesAt!,
    isClosed: false,
    notes: entry.notes?.trim() ?? null,
    reservationIntervalMinutes,
    reservationSlotTimes,
  };
}

function validateOverride(entry: UpdateOperatingHourOverride): OperatingHourOverride {
  if (!DATE_REGEX.test(entry.effectiveDate)) {
    throw new Error(`Override effectiveDate must be YYYY-MM-DD`);
  }

  const isClosed = entry.isClosed ?? false;
  const opensAt = canonicalOptionalTime(entry.opensAt ?? null, `Override ${entry.effectiveDate} opensAt`);
  const closesAt = canonicalOptionalTime(entry.closesAt ?? null, `Override ${entry.effectiveDate} closesAt`);
  const reservationIntervalMinutes = normalizeInterval(
    entry.reservationIntervalMinutes ?? null,
    `Override ${entry.effectiveDate} reservationIntervalMinutes`,
  );
  const reservationSlotTimes = normalizeSlotTimes(
    entry.reservationSlotTimes ?? null,
    `Override ${entry.effectiveDate} reservationSlotTimes`,
  );

  if (!isClosed) {
    ensureOpenBeforeClose(opensAt, closesAt, `Override ${entry.effectiveDate}`);
  }

  return {
    id: entry.id?.trim() || randomUUID(),
    effectiveDate: entry.effectiveDate,
    opensAt: isClosed ? null : opensAt!,
    closesAt: isClosed ? null : closesAt!,
    isClosed,
    notes: entry.notes?.trim() ?? null,
    reservationIntervalMinutes: isClosed ? null : reservationIntervalMinutes,
    reservationSlotTimes: isClosed ? null : reservationSlotTimes,
  };
}

function buildDefaultWeeklySchedule(existing: WeeklyOperatingHour[]): WeeklyOperatingHour[] {
  const byDay = new Map(existing.map((entry) => [entry.dayOfWeek, entry]));
  const schedule: WeeklyOperatingHour[] = [];

  for (let day = 0; day < DAYS_IN_WEEK; day += 1) {
    const current = byDay.get(day);
    if (current) {
      schedule.push(current);
    } else {
      schedule.push({
        dayOfWeek: day,
        opensAt: null,
        closesAt: null,
        isClosed: true,
        notes: null,
        reservationIntervalMinutes: null,
        reservationSlotTimes: null,
      });
    }
  }

  return schedule;
}

export async function getOperatingHours(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<OperatingHoursSnapshot> {
  const [{ data: restaurantRows, error: restaurantError }, { data: weeklyRows, error: weeklyError }, { data: overrideRows, error: overrideError }] =
    await Promise.all([
      client
        .from('restaurants')
        .select('id, timezone')
        .eq('id', restaurantId)
        .maybeSingle(),
      client
        .from('restaurant_operating_hours')
        .select(
          'id, day_of_week, opens_at, closes_at, is_closed, notes, reservation_interval_minutes, reservation_slot_times',
        )
        .eq('restaurant_id', restaurantId)
        .is('effective_date', null)
        .order('day_of_week', { ascending: true }),
      client
        .from('restaurant_operating_hours')
        .select(
          'id, effective_date, opens_at, closes_at, is_closed, notes, reservation_interval_minutes, reservation_slot_times',
        )
        .eq('restaurant_id', restaurantId)
        .not('effective_date', 'is', null)
        .order('effective_date', { ascending: true }),
    ]);

  if (restaurantError) {
    throw restaurantError;
  }

  if (!restaurantRows) {
    throw new Error('Restaurant not found');
  }

  if (weeklyError) {
    throw weeklyError;
  }

  if (overrideError) {
    throw overrideError;
  }

  const weekly: WeeklyOperatingHour[] = (weeklyRows ?? []).map((row) => ({
    dayOfWeek: row.day_of_week ?? 0,
    opensAt: canonicalizeFromDb(row.opens_at),
    closesAt: canonicalizeFromDb(row.closes_at),
    isClosed: row.is_closed ?? false,
    notes: row.notes ?? null,
    reservationIntervalMinutes: row.reservation_interval_minutes ?? null,
    reservationSlotTimes: normalizeSlotTimesFromDb(row.reservation_slot_times),
  }));

  const overrides: OperatingHourOverride[] = (overrideRows ?? []).map((row) => ({
    id: row.id,
    effectiveDate: row.effective_date ?? '',
    opensAt: canonicalizeFromDb(row.opens_at),
    closesAt: canonicalizeFromDb(row.closes_at),
    isClosed: row.is_closed ?? false,
    notes: row.notes ?? null,
    reservationIntervalMinutes: row.reservation_interval_minutes ?? null,
    reservationSlotTimes: normalizeSlotTimesFromDb(row.reservation_slot_times),
  }));

  return {
    restaurantId,
    timezone: restaurantRows.timezone,
    weekly: buildDefaultWeeklySchedule(weekly),
    overrides,
  };
}

export async function updateOperatingHours(
  restaurantId: string,
  payload: UpdateOperatingHoursPayload,
  client: DbClient = getServiceSupabaseClient(),
): Promise<OperatingHoursSnapshot> {
  const validatedWeekly = payload.weekly.map((entry) => validateWeeklyEntry(entry));

  const uniqueDays = new Set<number>();
  validatedWeekly.forEach((entry) => {
    if (uniqueDays.has(entry.dayOfWeek)) {
      throw new Error(`Duplicate weekly entry for day ${entry.dayOfWeek}`);
    }
    uniqueDays.add(entry.dayOfWeek);
  });

  const validatedOverrides = payload.overrides.map((entry) => validateOverride(entry));

  const insertRows: OperatingHoursInsert[] = [
    ...validatedWeekly.map<OperatingHoursInsert>((entry) => ({
      id: randomUUID(),
      restaurant_id: restaurantId,
      day_of_week: entry.dayOfWeek,
      effective_date: null,
      opens_at: entry.isClosed ? null : entry.opensAt,
      closes_at: entry.isClosed ? null : entry.closesAt,
      is_closed: entry.isClosed,
      notes: entry.notes,
      reservation_interval_minutes: entry.reservationIntervalMinutes,
      reservation_slot_times: entry.reservationSlotTimes,
    })),
    ...validatedOverrides.map<OperatingHoursInsert>((entry) => ({
      id: entry.id,
      restaurant_id: restaurantId,
      day_of_week: null,
      effective_date: entry.effectiveDate,
      opens_at: entry.isClosed ? null : entry.opensAt,
      closes_at: entry.isClosed ? null : entry.closesAt,
      is_closed: entry.isClosed,
      notes: entry.notes,
      reservation_interval_minutes: entry.reservationIntervalMinutes,
      reservation_slot_times: entry.reservationSlotTimes,
    })),
  ];

  const { error: deleteError } = await client
    .from('restaurant_operating_hours')
    .delete()
    .eq('restaurant_id', restaurantId);

  if (deleteError) {
    throw deleteError;
  }

  if (insertRows.length > 0) {
    const { error: insertError } = await client.from('restaurant_operating_hours').insert(insertRows);
    if (insertError) {
      throw insertError;
    }
  }

  return getOperatingHours(restaurantId, client);
}
