import { createHash, createHmac } from 'node:crypto';

import { normalizeEmail } from '@/server/customers';
import { consumeRateLimit } from '@/server/security/rate-limit';

/**
 * Per-contact throttle for lost-link emails. Shared by POST
 * /api/bookings/lookup-email and (from S1b) the create path's
 * BOOKING_NOT_COMPLETED response, so both count against the same budget.
 *
 * The key is a keyed hash of `restaurantId + normalized email`: no raw email
 * ever appears in a rate-limit identifier.
 */

export const CONTACT_THROTTLE_HOURLY = { limit: 3, windowMs: 60 * 60 * 1000 } as const;
export const CONTACT_THROTTLE_DAILY = { limit: 5, windowMs: 24 * 60 * 60 * 1000 } as const;

export function lookupContactKey(params: {
  restaurantId: string;
  email: string;
  secret: string;
}): string {
  const key = createHash('sha256').update(`booking-lookup-contact:${params.secret}`).digest();
  return createHmac('sha256', key)
    .update(`${params.restaurantId}\n${normalizeEmail(params.email)}`)
    .digest('hex');
}

export type ContactThrottleResult = { allowed: boolean };

/**
 * Consumes one unit of the hourly and the daily budget for a contact key.
 * Both counters always advance; the request is allowed only when both are
 * within their limit. A limiter failure denies (fails closed): the caller
 * still answers neutrally, it just sends nothing.
 */
export async function consumeContactThrottle(
  contactKey: string,
  deps: { consume?: typeof consumeRateLimit } = {},
): Promise<ContactThrottleResult> {
  const consume = deps.consume ?? consumeRateLimit;
  try {
    const [hourly, daily] = await Promise.all([
      consume({
        identifier: `bookings:lookup-email:contact-h:${contactKey}`,
        limit: CONTACT_THROTTLE_HOURLY.limit,
        windowMs: CONTACT_THROTTLE_HOURLY.windowMs,
      }),
      consume({
        identifier: `bookings:lookup-email:contact-d:${contactKey}`,
        limit: CONTACT_THROTTLE_DAILY.limit,
        windowMs: CONTACT_THROTTLE_DAILY.windowMs,
      }),
    ]);
    return { allowed: hourly.ok && daily.ok };
  } catch {
    return { allowed: false };
  }
}
