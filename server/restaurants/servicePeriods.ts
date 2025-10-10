import { randomUUID } from 'crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getServiceSupabaseClient } from '@/server/supabase';
import type { Database } from '@/types/supabase';

type DbClient = SupabaseClient<Database, 'public', any>;

export type BookingOption = 'lunch' | 'dinner' | 'drinks';

export type ServicePeriod = {
  id: string;
  name: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  bookingOption: BookingOption;
};

export type UpdateServicePeriod = {
  id?: string;
  name: string;
  dayOfWeek?: number | null;
  startTime: string;
  endTime: string;
  bookingOption: BookingOption;
};

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const BOOKING_OPTIONS = new Set<BookingOption>(['lunch', 'dinner', 'drinks']);

function normalizeTime(value: string): string {
  const trimmed = value.trim();
  if (!TIME_REGEX.test(trimmed)) {
    throw new Error(`Invalid time value "${value}", expected HH:MM`);
  }
  return trimmed;
}

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
  const normalized = value.toLowerCase() as BookingOption;
  if (!BOOKING_OPTIONS.has(normalized)) {
    throw new Error(`Invalid booking option "${value}"`);
  }
  return normalized;
}

function validateServicePeriod(entry: UpdateServicePeriod): ServicePeriod {
  const name = entry.name.trim();
  if (!name) {
    throw new Error('Service period name is required');
  }

  const dayOfWeek = normalizeDayOfWeek(entry.dayOfWeek ?? null);
  const startTime = normalizeTime(entry.startTime);
  const endTime = normalizeTime(entry.endTime);
  const bookingOption = normalizeBookingOption(entry.bookingOption);

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
  };
}

export async function getServicePeriods(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<ServicePeriod[]> {
  const { data, error } = await client
    .from('restaurant_service_periods')
    .select('id, name, day_of_week, start_time, end_time, booking_option')
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
    startTime: row.start_time,
    endTime: row.end_time,
    bookingOption: normalizeBookingOption(row.booking_option as BookingOption),
  }));
}

export async function updateServicePeriods(
  restaurantId: string,
  periods: UpdateServicePeriod[],
  client: DbClient = getServiceSupabaseClient(),
): Promise<ServicePeriod[]> {
  const validated = periods.map((entry) => validateServicePeriod(entry));

  // Prevent overlapping periods for the same day (including null day)
  const byDay = new Map<number | null, ServicePeriod[]>();
  validated.forEach((period) => {
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
      if (prev.endTime > current.startTime) {
        const label = key === null ? 'all days' : `day ${key}`;
        throw new Error(`Service periods overlap on ${label}: "${prev.name}" and "${current.name}"`);
      }
    }
  });

  const { error: deleteError } = await client
    .from('restaurant_service_periods')
    .delete()
    .eq('restaurant_id', restaurantId);

  if (deleteError) {
    throw deleteError;
  }

  if (validated.length > 0) {
    const insertRows = validated.map((period) => ({
      id: period.id,
      restaurant_id: restaurantId,
      name: period.name,
      day_of_week: period.dayOfWeek,
      start_time: period.startTime,
      end_time: period.endTime,
      booking_option: period.bookingOption,
    }));

    const { error: insertError } = await client.from('restaurant_service_periods').insert(insertRows);
    if (insertError) {
      throw insertError;
    }
  }

  return getServicePeriods(restaurantId, client);
}
