# Review Pass 2: Booking Detail and Recovery

## Coverage Verdict

- insufficient: pass-1 closed most route and recovery-link gaps, but the contract still misses the degraded public-detail recovery path where `/bookings/[bookingId]` admits on `sr_access` cookie presence and then falls into the shared detail error UI when the booking API rejects that recovery session.

## Remaining Gaps

- The contract does not validate the user-visible failure state after a recovery-cookie handoff succeeds at the page gate but fails at data load. On the current frontend, `/bookings/[bookingId]` only checks that `sr_access` exists, while `/api/bookings/[id]` can still return `INVALID_ACCESS_TOKEN`, `ACCESS_TOKEN_EXPIRED`, or `FORBIDDEN`; the resulting experience is the shared `GuestError` card with `Try again` plus `Return to dashboard`. That recovery/degradation surface is still in scope and currently uncontracted.

## Optional Tightening

- Add an explicit assertion for the shared detail back/exit affordance. `BookingSummaryCard` defaults its back button to `/guest/dashboard`, and the public-detail error fallback also exits to `/guest/dashboard`; if navigation consistency is a key mission concern, the contract should pin that target instead of only checking generic shell parity.
- If desired, tighten the detail-shell assertion to cover read-only/manage-disabled states for cancelled, past, or locked pending bookings, since the current section only checks action presence/order when actions are shown.

## Evidence

- `validation-contract.md` now covers the major pass-1 holes: public and guest auth redirects (`VAL-DETAIL-002`, `VAL-DETAIL-004`), manage alias canonicalization (`VAL-DETAIL-003`), legacy token failure (`VAL-DETAIL-005`), recovery-route sanitization/error mapping (`VAL-DETAIL-006`), shared mobile action hierarchy (`VAL-DETAIL-007`), and recovery-error copy/CTA limits (`VAL-DETAIL-008`).
- `src/app/(public)/bookings/[bookingId]/page.tsx` grants access when an `sr_access` cookie merely exists, without validating the cookie before rendering the detail surface.
- `src/app/api/bookings/[id]/route.ts` separately validates the recovery token and can still reject the session with `INVALID_ACCESS_TOKEN`, `ACCESS_TOKEN_EXPIRED`, or `FORBIDDEN`.
- `src/components/features/booking/detail/ReservationDetailClient.tsx` turns that rejected fetch into the shared guest-facing error card and currently routes its fallback CTA to `/guest/dashboard`.
- `src/components/features/booking/ui/BookingComponents.tsx` shows the summary-shell back button also defaults to `/guest/dashboard`, which is not asserted anywhere in the detail section today.
