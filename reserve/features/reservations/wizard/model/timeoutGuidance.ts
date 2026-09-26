/**
 * Plan-step alert shown after an unrecovered submit timeout when the guest gave
 * an email. PlanStep recognises this exact text and renders the find-booking
 * action as a real link, so the alert never shows a raw path.
 */
export const TIMEOUT_EMAIL_GUIDANCE_ALERT =
  'If you received a confirmation email you are all set. No email? Request your booking link, or retry now.';

export const FIND_BOOKING_LINK_LABEL = 'Request your booking link';

/** `/bookings/find`, scoped to the venue when its slug is known. */
export function buildFindBookingPath(restaurantSlug?: string | null): string {
  const slug = restaurantSlug?.trim();
  return slug ? `/bookings/find?restaurant=${encodeURIComponent(slug)}` : '/bookings/find';
}
