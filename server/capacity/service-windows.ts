import { getServiceSupabaseClient } from '@/server/supabase';

import type { ServiceKey, ServiceWindowsByService } from '@/server/capacity/policy';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

type ServicePeriodRow = {
  booking_option: string | null;
  start_time: string | null;
  end_time: string | null;
};

const TIME_PATTERN = /^(\d{1,2}):(\d{2})/;

function parseMinutesOfDay(value: string | null): number | null {
  const match = TIME_PATTERN.exec(value ?? '');
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

function toTimeOfDay(minutes: number): { hour: number; minute: number } {
  return { hour: Math.floor(minutes / 60) % 24, minute: minutes % 60 };
}

/**
 * Derives per-service (lunch/dinner) booking windows from the restaurant's
 * configured `restaurant_service_periods`, the same table that gates which
 * slots are offered to guests. For each service the window spans the earliest
 * period start to the latest period end (periods crossing midnight extend past
 * 24:00 and map onto the policy's next-day handling). Services without any
 * period rows are omitted, so the hardcoded policy defaults still apply.
 *
 * This is the source-of-truth fix for the service-period/policy mismatch that
 * made valid configured slots (e.g. a 22:15 dinner or 15:00 lunch) throw
 * ServiceNotFoundError and fall back.
 */
export async function getRestaurantServiceWindows(
  restaurantId: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<ServiceWindowsByService> {
  const { data, error } = await client
    .from('restaurant_service_periods')
    .select('booking_option, start_time, end_time')
    .eq('restaurant_id', restaurantId);

  if (error) {
    throw error;
  }

  const spans = new Map<ServiceKey, { start: number; end: number }>();
  for (const row of (data ?? []) as ServicePeriodRow[]) {
    const key = row.booking_option?.toString().trim().toLowerCase();
    if (key !== 'lunch' && key !== 'dinner') continue;

    const start = parseMinutesOfDay(row.start_time);
    let end = parseMinutesOfDay(row.end_time);
    if (start === null || end === null) continue;
    if (end <= start) {
      end += 24 * 60;
    }

    const existing = spans.get(key);
    spans.set(key, {
      start: Math.min(existing?.start ?? start, start),
      end: Math.max(existing?.end ?? end, end),
    });
  }

  const windows: ServiceWindowsByService = {};
  for (const [key, span] of spans) {
    windows[key] = { start: toTimeOfDay(span.start), end: toTimeOfDay(span.end) };
  }
  return windows;
}

/**
 * Best-effort variant for capacity paths: a service-window load failure must
 * not break window computation, it just falls back to the default policy
 * windows (and, when out of window, the bounded fallback rules).
 */
export async function getRestaurantServiceWindowsSafe(
  restaurantId: string,
  client?: DbClient,
): Promise<ServiceWindowsByService> {
  try {
    return await getRestaurantServiceWindows(restaurantId, client);
  } catch (error) {
    console.warn('[capacity.service-windows] load failed; using default policy windows', {
      restaurantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}
