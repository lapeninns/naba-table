import { getVenuePolicy, ServiceOverrunError, type VenuePolicy } from '@/server/capacity/policy';
import { hashPolicyVersion } from '@/server/capacity/v2';
import { getRestaurantTurnBands } from '@/server/restaurants/turnBands';

import { computeBookingWindowWithFallback, type ComputeWindowArgs } from './booking-window';
import { loadBooking, loadRestaurantTimezone, type DbClient } from './supabase';
import { ManualSelectionInputError, type BookingWindow } from './types';

export type ManualBookingRecord = Awaited<ReturnType<typeof loadBooking>>;

export type ManualBookingPolicyContext = {
  policy: VenuePolicy;
  policyVersion: string;
  restaurantTimezone: string | null;
};

export type ManualBookingContext = ManualBookingPolicyContext & {
  booking: ManualBookingRecord;
  window: BookingWindow;
};

export function resolveManualBookingTimezone({
  booking,
  fallbackTimezone,
}: {
  booking: ManualBookingRecord;
  fallbackTimezone: string;
}): string {
  return (
    (booking.restaurants && !Array.isArray(booking.restaurants)
      ? booking.restaurants.timezone
      : null) ?? fallbackTimezone
  );
}

export function buildManualBookingWindowArgs({
  booking,
  policy,
}: {
  booking: ManualBookingRecord;
  policy: VenuePolicy;
}): ComputeWindowArgs {
  return {
    startISO: booking.start_at,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    partySize: booking.party_size,
    bookingOption: booking.booking_type ?? null,
    policy,
  };
}

export function resolveManualBookingWindow({
  booking,
  policy,
}: {
  booking: ManualBookingRecord;
  policy: VenuePolicy;
}): BookingWindow {
  try {
    return computeBookingWindowWithFallback(buildManualBookingWindowArgs({ booking, policy }))
      .window;
  } catch (error) {
    throw translateManualBookingWindowError(error);
  }
}

export function translateManualBookingWindowError(error: unknown): never {
  if (error instanceof ServiceOverrunError) {
    throw new ManualSelectionInputError(error.message, 'SERVICE_OVERRUN', 422);
  }
  throw error;
}

export async function loadManualBookingPolicyContext({
  booking,
  client,
}: {
  booking: ManualBookingRecord;
  client: DbClient;
}): Promise<ManualBookingPolicyContext> {
  const restaurantTimezone =
    resolveManualBookingTimezone({
      booking,
      fallbackTimezone:
        (await loadRestaurantTimezone(booking.restaurant_id, client)) ?? getVenuePolicy().timezone,
    }) ?? null;
  const turnBandsByOption = await getRestaurantTurnBands(booking.restaurant_id, client);
  const policy = getVenuePolicy({
    timezone: restaurantTimezone ?? undefined,
    turnBandsByOption,
  });

  return {
    policy,
    policyVersion: hashPolicyVersion(policy),
    restaurantTimezone,
  };
}

export async function loadManualBookingContext({
  bookingId,
  client,
}: {
  bookingId: string;
  client: DbClient;
}): Promise<ManualBookingContext> {
  const booking = await loadBooking(bookingId, client);
  const policyContext = await loadManualBookingPolicyContext({ booking, client });
  const window = resolveManualBookingWindow({
    booking,
    policy: policyContext.policy,
  });

  return {
    ...policyContext,
    booking,
    window,
  };
}
