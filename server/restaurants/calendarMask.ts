import { DateTime } from 'luxon';

import { getServiceSupabaseClient } from '@/server/supabase';

import type { CalendarMask } from '@reserve/features/reservations/wizard/services/schedule';

export class GetCalendarMaskError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'GetCalendarMaskError';
    if (options?.cause) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

type CalendarMaskArgs = {
  restaurantId: string;
  timezone: string | null | undefined;
  from: string;
  to: string;
};

const normalizeDayOfWeek = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  // Database stores ISO 1-7 (Mon-Sun). Convert to 0-6 with Sunday=0.
  const normalized = value % 7;
  return normalized;
};

export async function getRestaurantCalendarMask({
  restaurantId,
  timezone,
  from,
  to,
}: CalendarMaskArgs): Promise<CalendarMask> {
  const zone = timezone?.trim() || 'UTC';
  const supabase = getServiceSupabaseClient();

  const { data: weeklyRows, error: weeklyError } = await supabase
    .from('restaurant_operating_hours')
    .select('day_of_week, is_closed')
    .eq('restaurant_id', restaurantId)
    .is('effective_date', null);

  if (weeklyError) {
    throw new GetCalendarMaskError('[calendar-mask] failed to load weekly hours', {
      cause: weeklyError,
    });
  }

  const closedDaysSet = new Set<number>();
  for (const row of weeklyRows ?? []) {
    if (!row?.is_closed) {
      continue;
    }
    const normalized = normalizeDayOfWeek(row.day_of_week);
    if (normalized !== null) {
      closedDaysSet.add(normalized);
    }
  }

  const { data: closureRows, error: closureError } = await supabase
    .from('restaurant_operating_hours')
    .select('effective_date')
    .eq('restaurant_id', restaurantId)
    .not('effective_date', 'is', null)
    .eq('is_closed', true)
    .gte('effective_date', from)
    .lte('effective_date', to);

  if (closureError) {
    throw new GetCalendarMaskError('[calendar-mask] failed to load closure overrides', {
      cause: closureError,
    });
  }

  const closedDateSet = new Set<string>();
  for (const row of closureRows ?? []) {
    if (!row?.effective_date) {
      continue;
    }
    const date = DateTime.fromISO(row.effective_date, { zone })
      .startOf('day')
      .toISODate();
    if (date) {
      closedDateSet.add(date);
    }
  }

  return {
    timezone: zone,
    from,
    to,
    closedDaysOfWeek: Array.from(closedDaysSet.values()).sort((a, b) => a - b),
    closedDates: Array.from(closedDateSet.values()).sort(),
  };
}

type InitialCalendarMaskArgs = {
  restaurantId: string;
  timezone: string | null | undefined;
  referenceDate?: Date;
};

export async function getInitialCalendarMask({
  restaurantId,
  timezone,
  referenceDate,
}: InitialCalendarMaskArgs): Promise<CalendarMask | null> {
  const zone = timezone?.trim() || 'UTC';
  const reference = referenceDate
    ? DateTime.fromJSDate(referenceDate, { zone })
    : DateTime.now().setZone(zone);

  if (!reference.isValid) {
    return null;
  }

  const from = reference.startOf('month').toISODate();
  const to = reference.endOf('month').toISODate();

  if (!from || !to) {
    return null;
  }

  try {
    return await getRestaurantCalendarMask({
      restaurantId,
      timezone: zone,
      from,
      to,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[calendar-mask] failed to load initial month mask', {
        restaurantId,
        error,
      });
    }
    return null;
  }
}
