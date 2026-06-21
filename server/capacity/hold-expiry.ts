/**
 * Clock-skew pad for hold-expiry lower bounds.
 *
 * Hold conflict/active-hold queries filter `expires_at > now`. If the app clock
 * runs ahead of the database clock, a hold that is still live in the DB can be
 * read as already expired, letting an assignment slip past a real hold and
 * double-book. Padding the lower bound by this many milliseconds
 * (`expires_at > now - HOLD_EXPIRY_SKEW_MS`) keeps near-boundary holds visible to
 * conflict detection — the SAFE direction for a fail-closed check.
 *
 * Single source of truth shared by the date/window readers in
 * `table-assignment/supabase.ts` (`holdExpiryLowerBoundIso`,
 * `fetchHoldsForWindow`, `loadActiveHoldsForDate`) and the conflict/active-hold
 * detectors in `holds.ts` (`findHoldConflicts`, `listActiveHoldsForBooking`).
 */
export const HOLD_EXPIRY_SKEW_MS = 5_000;
