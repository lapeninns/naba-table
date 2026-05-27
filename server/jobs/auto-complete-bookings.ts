import { DateTime } from 'luxon';

import { clearBookingTableAssignments } from '@/server/bookings';
import { resolveBookingEndAtUtc } from '@/server/bookings/booking-access';
import { enqueueCheckOutSideEffects } from '@/server/jobs/booking-side-effects';
import {
  prepareCheckInTransition,
  prepareCheckOutTransition,
} from '@/server/ops/booking-lifecycle/actions';
import { BookingLifecycleError } from '@/server/ops/booking-lifecycle/stateMachine';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { TransitionResult } from '@/server/ops/booking-lifecycle/actions';
import type { Database, Tables } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_WINDOW_MINUTES = 30;
const DEFAULT_LIMIT = 200;
const DEFAULT_LOOKBACK_DAYS = 30;
const ACTOR_ID_OVERRIDE = process.env.AUTO_COMPLETE_ACTOR_ID?.trim() || null;

type RestaurantRow = Pick<
  Tables<'restaurants'>,
  'id' | 'name' | 'timezone' | 'reservation_lifecycle_grace_minutes'
>;

type BookingRow = Pick<
  Tables<'bookings'>,
  | 'id'
  | 'restaurant_id'
  | 'status'
  | 'start_at'
  | 'end_at'
  | 'booking_date'
  | 'start_time'
  | 'end_time'
  | 'checked_in_at'
  | 'checked_out_at'
  | 'customer_email'
>;

type AutoCompleteOptions = {
  dryRun?: boolean;
  limit?: number;
  windowMinutes?: number;
  now?: Date;
};

export type AutoCompleteSummary = {
  mode: 'dry-run' | 'apply';
  nowUtc: string;
  windowMinutes: number;
  limit: number;
  restaurantsTotal: number;
  restaurantsProcessed: number;
  restaurantsSkippedWindow: number;
  candidates: number;
  completed: number;
  skipped: number;
  errors: number;
};

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function normalizeTimezone(timezone?: string | null): string {
  const trimmed = timezone?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'Europe/London';
}

function resolveLocalDateTime(
  date: string | null,
  time: string | null,
  timezone: string,
): DateTime | null {
  if (!date || !time) return null;
  const iso = `${date}T${time}`;
  const dt = DateTime.fromISO(iso, { zone: timezone });
  return dt.isValid ? dt : null;
}

function toUtcIso(dt: DateTime | null): string | null {
  if (!dt) return null;
  const utc = dt.toUTC();
  return utc.isValid ? utc.toISO() : null;
}

function computeStartAtUtc(booking: BookingRow, timezone: string): string | null {
  if (booking.start_at) return booking.start_at;
  const dt = resolveLocalDateTime(booking.booking_date, booking.start_time, timezone);
  return toUtcIso(dt);
}

async function resolveActorId(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
): Promise<string | null> {
  if (ACTOR_ID_OVERRIDE) return ACTOR_ID_OVERRIDE;

  const { data, error } = await supabase
    .from('restaurant_memberships')
    .select('user_id, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[cron][auto-complete] failed to resolve membership', {
      restaurantId,
      error: error.message,
    });
  }

  const membershipUserId = data?.user_id ?? null;
  if (membershipUserId) {
    try {
      const { data: authData } = await supabase.auth.admin.getUserById(membershipUserId);
      if (authData?.user?.id) {
        return membershipUserId;
      }
    } catch (authError) {
      console.warn('[cron][auto-complete] failed to verify membership user', {
        restaurantId,
        error: formatError(authError),
      });
    }
  }

  return null;
}

async function applyTransition(
  supabase: SupabaseClient<Database>,
  booking: BookingRow,
  transition: TransitionResult,
): Promise<{
  status: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  updatedAt: string | null;
} | null> {
  if (transition.skipUpdate) {
    return {
      status: transition.response.status,
      checkedInAt: transition.response.checkedInAt,
      checkedOutAt: transition.response.checkedOutAt,
      updatedAt: transition.response.updatedAt ?? null,
    };
  }

  const history = transition.history;
  if (!history) {
    throw new Error('Missing history payload for transition');
  }

  const targetStatus = (transition.updates.status ??
    booking.status) as Tables<'bookings'>['status'];
  const finalCheckedInAt =
    transition.updates.checked_in_at !== undefined
      ? (transition.updates.checked_in_at ?? null)
      : (booking.checked_in_at ?? null);
  const finalCheckedOutAt =
    transition.updates.checked_out_at !== undefined
      ? (transition.updates.checked_out_at ?? null)
      : (booking.checked_out_at ?? null);
  const finalUpdatedAt = transition.updates.updated_at ?? new Date().toISOString();

  const { data, error } = await supabase.rpc('apply_booking_state_transition', {
    p_booking_id: booking.id,
    p_status: targetStatus,
    p_checked_in_at: finalCheckedInAt,
    p_checked_out_at: finalCheckedOutAt,
    p_updated_at: finalUpdatedAt,
    p_history_from: history.from_status ?? booking.status,
    p_history_to: history.to_status,
    p_history_changed_by: history.changed_by ?? null,
    p_history_changed_at: history.changed_at ?? finalUpdatedAt,
    p_history_reason: history.reason ?? 'status_change',
    p_history_metadata: history.metadata ?? {},
  });

  if (error) {
    throw error;
  }

  const row = data?.[0];
  return {
    status: row?.status ?? targetStatus,
    checkedInAt: row?.checked_in_at ?? finalCheckedInAt,
    checkedOutAt: row?.checked_out_at ?? finalCheckedOutAt,
    updatedAt: row?.updated_at ?? finalUpdatedAt,
  };
}

async function fetchRestaurants(supabase: SupabaseClient<Database>): Promise<RestaurantRow[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, timezone, reservation_lifecycle_grace_minutes')
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as RestaurantRow[];
}

async function fetchEligibleBookings(
  supabase: SupabaseClient<Database>,
  restaurantId: string,
  lookbackStartDate: string,
  localDate: string,
  limit: number,
): Promise<BookingRow[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      [
        'id',
        'restaurant_id',
        'status',
        'start_at',
        'end_at',
        'booking_date',
        'start_time',
        'end_time',
        'checked_in_at',
        'checked_out_at',
        'customer_email',
      ].join(','),
    )
    .eq('restaurant_id', restaurantId)
    .in('status', ['confirmed', 'checked_in'])
    .gte('booking_date', lookbackStartDate)
    .lte('booking_date', localDate)
    .order('booking_date', { ascending: true })
    .order('end_at', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as BookingRow[];
}

function resolveGraceMinutes(restaurant: RestaurantRow, fallbackMinutes: number): number {
  const value = restaurant.reservation_lifecycle_grace_minutes;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.min(value, 24 * 60);
  }
  return fallbackMinutes;
}

function resolveCheckoutAtUtc(
  endAt: DateTime,
  checkedInAt: string | null,
  nowUtc: DateTime,
): string | null {
  let checkoutAt = endAt;
  if (checkedInAt) {
    const checkedIn = DateTime.fromISO(checkedInAt, { zone: 'utc' });
    if (checkedIn.isValid && checkedIn > checkoutAt) {
      checkoutAt = checkedIn;
    }
  }
  if (checkoutAt > nowUtc) {
    checkoutAt = nowUtc;
  }
  return checkoutAt.toUTC().toISO();
}

export async function autoCompletePastBookings(
  options: AutoCompleteOptions = {},
): Promise<AutoCompleteSummary> {
  const windowMinutes =
    typeof options.windowMinutes === 'number' && options.windowMinutes > 0
      ? Math.min(options.windowMinutes, 180)
      : DEFAULT_WINDOW_MINUTES;
  const limit =
    typeof options.limit === 'number' && options.limit > 0 ? options.limit : DEFAULT_LIMIT;
  const dryRun = options.dryRun ?? false;
  const nowUtc = options.now ? DateTime.fromJSDate(options.now, { zone: 'utc' }) : DateTime.utc();
  const lookbackStartUtc = nowUtc.minus({ days: DEFAULT_LOOKBACK_DAYS }).toUTC();
  if (!lookbackStartUtc.isValid) {
    throw new Error('Failed to resolve auto-complete lookback window');
  }

  const supabase = getServiceSupabaseClient();
  const restaurants = await fetchRestaurants(supabase);

  let restaurantsProcessed = 0;
  let restaurantsSkippedWindow = 0;
  let candidates = 0;
  let completed = 0;
  let skipped = 0;
  let errors = 0;

  for (const restaurant of restaurants) {
    if (candidates >= limit) {
      break;
    }

    let timezone = normalizeTimezone(restaurant.timezone);
    let localNow = nowUtc.setZone(timezone);
    if (!localNow.isValid) {
      timezone = 'UTC';
      localNow = nowUtc;
    }

    const localDate = localNow.toISODate();
    const lookbackStartDate = localNow.minus({ days: DEFAULT_LOOKBACK_DAYS }).toISODate();
    if (!localDate || !lookbackStartDate) {
      restaurantsSkippedWindow += 1;
      continue;
    }

    const graceMinutes = resolveGraceMinutes(restaurant, windowMinutes);
    const dueCutoffUtc = nowUtc.minus({ minutes: graceMinutes }).toUTC();
    if (!dueCutoffUtc.isValid) {
      restaurantsSkippedWindow += 1;
      continue;
    }

    const remaining = Math.max(0, limit - candidates);
    const bookings = await fetchEligibleBookings(
      supabase,
      restaurant.id,
      lookbackStartDate,
      localDate,
      remaining,
    );
    if (bookings.length === 0) continue;

    const actorId = await resolveActorId(supabase, restaurant.id);
    if (!actorId) {
      console.info('[cron][auto-complete] using system actor for restaurant with no actor', {
        restaurantId: restaurant.id,
      });
    }

    restaurantsProcessed += 1;

    for (const booking of bookings) {
      if (candidates >= limit) break;

      const effectiveEndAtUtc = resolveBookingEndAtUtc(booking, timezone);
      if (!effectiveEndAtUtc) {
        skipped += 1;
        continue;
      }

      const endAt = DateTime.fromISO(effectiveEndAtUtc);
      if (!endAt.isValid) {
        skipped += 1;
        continue;
      }
      if (endAt < lookbackStartUtc || endAt > dueCutoffUtc) {
        continue;
      }

      const startAtUtc = computeStartAtUtc(booking, timezone);

      candidates += 1;
      if (dryRun) {
        continue;
      }

      try {
        let currentBooking: BookingRow = booking;

        if (currentBooking.status === 'confirmed' || !currentBooking.checked_in_at) {
          const performedCheckInAt =
            currentBooking.checked_in_at ?? startAtUtc ?? effectiveEndAtUtc;
          if (!performedCheckInAt) {
            throw new Error('Missing start_at for check-in');
          }

          const checkIn = prepareCheckInTransition({
            booking: {
              id: currentBooking.id,
              status: currentBooking.status,
              checked_in_at: currentBooking.checked_in_at,
              checked_out_at: currentBooking.checked_out_at,
              booking_date: currentBooking.booking_date,
              start_time: currentBooking.start_time,
              restaurant_id: currentBooking.restaurant_id,
            },
            actorId,
            performedAt: performedCheckInAt,
            reason: 'auto-complete',
          });

          const checkInResult = await applyTransition(supabase, currentBooking, checkIn);
          if (!checkInResult) {
            throw new Error('Check-in transition failed');
          }

          currentBooking = {
            ...currentBooking,
            status: checkInResult.status as BookingRow['status'],
            checked_in_at: checkInResult.checkedInAt,
            checked_out_at: checkInResult.checkedOutAt,
          };
        }

        if (!currentBooking.checked_in_at) {
          throw new Error('Missing checked_in_at for check-out');
        }

        const checkoutAtUtc = resolveCheckoutAtUtc(endAt, currentBooking.checked_in_at, nowUtc);
        if (!checkoutAtUtc) {
          skipped += 1;
          continue;
        }

        const checkOut = prepareCheckOutTransition({
          booking: {
            id: currentBooking.id,
            status: currentBooking.status,
            checked_in_at: currentBooking.checked_in_at,
            checked_out_at: currentBooking.checked_out_at,
            booking_date: currentBooking.booking_date,
            start_time: currentBooking.start_time,
            restaurant_id: currentBooking.restaurant_id,
          },
          actorId,
          performedAt: checkoutAtUtc,
          reason: 'auto-complete',
        });

        const checkOutResult = await applyTransition(supabase, currentBooking, checkOut);
        if (!checkOutResult) {
          throw new Error('Check-out transition failed');
        }

        await clearBookingTableAssignments(supabase, currentBooking.id);

        try {
          const { data: fullBooking } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', currentBooking.id)
            .maybeSingle();

          if (fullBooking) {
            await enqueueCheckOutSideEffects(fullBooking as Tables<'bookings'>, restaurant.id, {
              supabase,
            });
          }
        } catch (sideEffectsError) {
          console.warn('[cron][auto-complete] failed to schedule review email', {
            bookingId: currentBooking.id,
            error: formatError(sideEffectsError),
          });
        }

        completed += 1;
      } catch (error) {
        errors += 1;
        const message = formatError(error);
        if (error instanceof BookingLifecycleError) {
          console.warn('[cron][auto-complete] lifecycle error', {
            bookingId: booking.id,
            code: error.code,
            error: message,
          });
        } else {
          console.warn('[cron][auto-complete] failed to complete booking', {
            bookingId: booking.id,
            error: message,
          });
        }
      }
    }
  }

  return {
    mode: dryRun ? 'dry-run' : 'apply',
    nowUtc: nowUtc.toISO() ?? nowUtc.toString(),
    windowMinutes,
    limit,
    restaurantsTotal: restaurants.length,
    restaurantsProcessed,
    restaurantsSkippedWindow,
    candidates,
    completed,
    skipped,
    errors,
  };
}
