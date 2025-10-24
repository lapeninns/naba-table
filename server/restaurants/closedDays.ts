import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/supabase';
import { getServiceSupabaseClient } from '@/server/supabase';
import { normalizeTime, toMinutes } from '@reserve/shared/time';

type DbClient = SupabaseClient<Database, 'public', any>;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type RawWeekly = {
  day_of_week: number | null;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean | null;
};

type RawOverride = {
  effective_date: string | null;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean | null;
};

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

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
    console.warn('[closedDays] failed to resolve weekday', { date, timezone, error });
  }
  const fallback = new Date(`${date}T00:00:00`);
  return Number.isNaN(fallback.getDay()) ? 0 : fallback.getDay();
}

function isRowClosed(opensAt: string | null, closesAt: string | null, isClosed: boolean | null): boolean {
  if (isClosed) return true;
  const open = normalizeTime(opensAt);
  const close = normalizeTime(closesAt);
  if (!open || !close) return true;
  return toMinutes(close) <= toMinutes(open);
}

function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split('-').map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, (m - 1), d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export async function getClosedDaysForRange(
  restaurantId: string,
  start: string,
  end: string,
  client: DbClient = getServiceSupabaseClient(),
): Promise<{ timezone: string; closed: string[] }> {
  if (!DATE_REGEX.test(start) || !DATE_REGEX.test(end)) {
    throw new Error('start and end must be YYYY-MM-DD');
  }

  // Load timezone and weekly rows + overrides in one go
  const [restaurantRes, weeklyRes, overrideRes] = await Promise.all([
    client.from('restaurants').select('timezone').eq('id', restaurantId).maybeSingle(),
    client
      .from('restaurant_operating_hours')
      .select('day_of_week, opens_at, closes_at, is_closed')
      .eq('restaurant_id', restaurantId)
      .is('effective_date', null),
    client
      .from('restaurant_operating_hours')
      .select('effective_date, opens_at, closes_at, is_closed')
      .eq('restaurant_id', restaurantId)
      .gte('effective_date', start)
      .lte('effective_date', end),
  ]);

  if (restaurantRes.error) throw restaurantRes.error;
  if (!restaurantRes.data) throw new Error('Restaurant not found');
  if (weeklyRes.error) throw weeklyRes.error;
  if (overrideRes.error) throw overrideRes.error;

  const timezone = restaurantRes.data.timezone ?? 'UTC';

  const weekly = (weeklyRes.data ?? []).reduce<Record<number, RawWeekly>>((acc, row) => {
    const day = row.day_of_week ?? 0;
    acc[day] = row;
    return acc;
  }, {});

  const overrides = new Map<string, RawOverride>();
  (overrideRes.data ?? []).forEach((row) => {
    const key = row.effective_date ?? '';
    if (key) overrides.set(key, row);
  });

  const closed: string[] = [];

  // Iterate inclusive range
  let cursor = start;
  // Protect against infinite loops
  let guard = 0;
  while (cursor <= end && guard < 400) {
    guard += 1;
    const override = overrides.get(cursor);
    if (override) {
      if (isRowClosed(override.opens_at, override.closes_at, override.is_closed)) {
        closed.push(cursor);
      }
    } else {
      const dow = resolveDayOfWeek(cursor, timezone);
      const weeklyRow = weekly[dow] ?? null;
      if (!weeklyRow || isRowClosed(weeklyRow.opens_at, weeklyRow.closes_at, weeklyRow.is_closed)) {
        closed.push(cursor);
      }
    }

    cursor = addDaysIso(cursor, 1);
  }

  return { timezone, closed };
}

