import { isAuthSessionMissingError } from '@supabase/supabase-js';

import { logger } from '@/lib/logger';
import { claimBookingForUser, type GuestSessionUser } from '@/server/bookings/guest-booking-access';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';

import type { BookingRecord } from '@/server/bookings';
import type { BookingCreateOrigin } from '@/server/bookings/idempotency';

/**
 * Guest-auth design §4.4 / §5.2, create path. With `SESSION_EMAIL_MATCH_ENABLED` off, "My
 * bookings" and session ownership match `bookings.auth_user_id` only, so a booking made by a
 * signed-in guest must be bound to that guest when it is inserted. The binding reuses the
 * link-redeem claim ({@link claimBookingForUser}): it binds only an unbound booking, only for
 * a user whose email Supabase records as confirmed, and only when that email equals the
 * booking's contact email. A staff member or friend booking for someone else (a different
 * email) is never bound.
 *
 * Only a fresh insert binds. A key replay or a recovered booking was matched by request data
 * the caller may not own, so it never changes the binding. Ops walk-ins act for staff, never
 * for the guest, and are skipped.
 *
 * Binding is best-effort: the booking is already committed, so any failure is logged without
 * PII and the create still succeeds. The guest can still claim it later from an emailed link.
 */

export type CreatorSessionUserResolver = () => Promise<GuestSessionUser | null>;
export type CreatedBookingClaimer = typeof claimBookingForUser;

type RouteClientFactory = () => Promise<{
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string; email?: string | null; email_confirmed_at?: string } | null };
      error: unknown;
    }>;
  };
}>;

/**
 * The request's Supabase user, or `null` when there is none. An anonymous request has no
 * session cookie, so `getUser` returns `AuthSessionMissingError` locally without a network
 * call; that is the normal case and is not logged. Any other failure is logged (status only).
 */
export async function resolveCreatorSessionUser(
  routeClientFor: RouteClientFactory = getRouteHandlerSupabaseClient as unknown as RouteClientFactory,
): Promise<GuestSessionUser | null> {
  try {
    const supabase = await routeClientFor();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      if (!isAuthSessionMissingError(error)) {
        logger.warn('bookings.create.owner_binding.session_failed', {
          status: readErrorStatus(error),
        });
      }
      return null;
    }
    if (!user) return null;
    return {
      id: user.id,
      email: user.email ?? null,
      email_confirmed_at: user.email_confirmed_at ?? null,
    };
  } catch {
    logger.warn('bookings.create.owner_binding.session_failed', { status: null });
    return null;
  }
}

function readErrorStatus(error: unknown): number | null {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : null;
  }
  return null;
}

/**
 * Binds a freshly inserted booking to the signed-in guest who made it, when eligible.
 * Returns the booking, with `auth_user_id` set when the claim succeeded. Never throws.
 */
export async function bindCreatedBookingToSessionOwner({
  booking,
  claimer = claimBookingForUser,
  createOrigin,
  isOpsWalkIn,
  sessionUserResolver = resolveCreatorSessionUser,
}: {
  booking: BookingRecord;
  claimer?: CreatedBookingClaimer;
  createOrigin: BookingCreateOrigin | undefined;
  isOpsWalkIn: boolean;
  sessionUserResolver?: CreatorSessionUserResolver;
}): Promise<BookingRecord> {
  if (createOrigin !== 'inserted' || isOpsWalkIn || booking.auth_user_id) {
    return booking;
  }

  try {
    const user = await sessionUserResolver();
    if (!user) return booking;

    const outcome = await claimer({ booking, user });
    if (outcome !== 'claimed') return booking;

    logger.info('bookings.create.owner_binding.bound', {
      bookingId: booking.id,
      restaurantId: booking.restaurant_id,
    });
    return { ...booking, auth_user_id: user.id };
  } catch {
    logger.warn('bookings.create.owner_binding.failed', { bookingId: booking.id });
    return booking;
  }
}
