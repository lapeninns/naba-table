import { DateTime } from 'luxon';

import { selectMatchingPeriod } from '@/server/restaurants/servicePeriodMatching';
import { getServicePeriods } from '@/server/restaurants/servicePeriods';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { ServicePeriod } from '@/server/restaurants/servicePeriods';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database>;

function resolveDayOfWeek(date: string, timezone?: string | null): number {
  const zoned = DateTime.fromISO(date, { zone: timezone ?? 'UTC' });
  if (!zoned.isValid) {
    return DateTime.utc().weekday % 7;
  }
  return zoned.weekday % 7;
}

export async function resolveBookingOptionForTime(params: {
  restaurantId: string;
  bookingDate: string;
  startTime: string;
  timezone?: string | null;
  client?: DbClient;
}): Promise<string | null> {
  const client = params.client ?? getServiceSupabaseClient();
  const periods = await getServicePeriods(params.restaurantId, client);
  if (periods.length === 0) {
    return null;
  }

  const dayOfWeek = resolveDayOfWeek(params.bookingDate, params.timezone);
  const matched = selectMatchingPeriod<ServicePeriod>(periods, params.startTime, dayOfWeek);
  return matched?.bookingOption ?? null;
}
