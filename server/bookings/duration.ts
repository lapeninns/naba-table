import { DateTime } from 'luxon';

import { calculateDurationMinutes, inferMealTypeFromTime } from '@/server/bookings';
import { resolveTurnBand, getVenuePolicy, type ServiceKey, type TurnBandsByOption } from '@/server/capacity/policy';
import { resolveBookingOptionForTime } from '@/server/restaurants/bookingOptionMatch';
import { getRestaurantTurnBands } from '@/server/restaurants/turnBands';

import type { BookingType } from '@/lib/enums';
import type { Database } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';


type DbClient = SupabaseClient<Database>;

type ResolveDurationInput = {
  restaurantId: string;
  bookingDate: string;
  startTime: string;
  partySize: number;
  bookingOption?: string | null;
  turnBandsByOption?: TurnBandsByOption | null;
  timezone?: string | null;
  client?: DbClient;
};

function normalizeOptionKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toString().trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function resolveServiceKeyFromTime(startTime: string): ServiceKey {
  const inferred = inferMealTypeFromTime(startTime);
  return inferred === 'lunch' ? 'lunch' : 'dinner';
}

function ensureValidDuration(duration: number, fallbackOption: string | null): number {
  if (Number.isFinite(duration) && duration > 0) {
    return Math.round(duration);
  }
  const fallback: BookingType = (fallbackOption === 'lunch' || fallbackOption === 'dinner') ? fallbackOption : 'dinner';
  return calculateDurationMinutes(fallback);
}

export async function resolveBookingDurationMinutes(input: ResolveDurationInput): Promise<{
  bookingOption: string | null;
  durationMinutes: number;
}> {
  const normalizedOption = normalizeOptionKey(input.bookingOption);

  const resolvedOption =
    normalizedOption ??
    (await resolveBookingOptionForTime({
      restaurantId: input.restaurantId,
      bookingDate: input.bookingDate,
      startTime: input.startTime,
      timezone: input.timezone,
      client: input.client,
    })) ??
    resolveServiceKeyFromTime(input.startTime);

  const turnBandsByOption =
    input.turnBandsByOption ?? (await getRestaurantTurnBands(input.restaurantId, input.client));
  const policy = getVenuePolicy({
    timezone: input.timezone ?? undefined,
    turnBandsByOption,
  });

  const fallbackServiceKey =
    resolvedOption === 'lunch' || resolvedOption === 'dinner'
      ? (resolvedOption as ServiceKey)
      : resolveServiceKeyFromTime(input.startTime);

  const resolvedBand = resolveTurnBand({
    serviceKey: fallbackServiceKey,
    partySize: input.partySize,
    bookingOption: resolvedOption,
    policy,
  });

  return {
    bookingOption: resolvedOption,
    durationMinutes: ensureValidDuration(resolvedBand.durationMinutes, resolvedOption),
  };
}

export function resolveServiceKeyForDateTime(input: {
  bookingDate: string;
  startTime: string;
  timezone?: string | null;
}): ServiceKey {
  const zoned = DateTime.fromISO(`${input.bookingDate}T${input.startTime}`, {
    zone: input.timezone ?? 'UTC',
  });

  if (!zoned.isValid) {
    return resolveServiceKeyFromTime(input.startTime);
  }

  const hour = zoned.hour;
  return hour >= 17 ? 'dinner' : 'lunch';
}
