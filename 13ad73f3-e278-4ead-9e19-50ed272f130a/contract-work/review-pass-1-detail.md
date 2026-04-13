# Review Pass 1: Booking Detail and Recovery

## Coverage Verdict

- insufficient: the draft covers the happy-path recovery handoff, manage alias, shell parity, and a generic recovery-error state, but it misses key route behaviors that the current frontend actually depends on: signed-out redirects, degraded recovery-cookie failures, exact mobile action hierarchy, and recovery endpoint/error-code coverage.

## Missing Assertions

- Public detail should verify the signed-out fallback: `/bookings/[bookingId]` redirects to `/auth/signin?redirectedFrom=/bookings/[bookingId]` when neither a user nor `sr_access` cookie is present. This is route behavior, not just implementation detail.
- Guest detail should verify its own signed-out fallback: `/guest/bookings/[bookingId]` uses the shared detail page but is supposed to preserve the guest return path on sign-in.
- Public detail should verify legacy-token handoff: `/bookings/[bookingId]?token=...` routes to `/bookings/recover/error?code=LEGACY_TOKEN_DEPRECATED`, not a silent failure or stale detail shell.
- Detail recovery should verify degraded recovery-session behavior: the public page only checks for presence of `sr_access`, while the booking API still rejects invalid/expired/mismatched tokens; the contract does not currently assert the resulting user-facing fallback at all.
- The contract does not cover `/bookings/recover` itself, even though that route owns `next` sanitization plus the missing/unconfigured/invalid/expired token mappings that feed the detail and error pages.
- The contract does not assert the detail back-navigation target, even though the shared summary component currently supplies a default back affordance and the mission explicitly calls out mobile continuity/navigation consistency.

## Weak Assertions To Tighten

- `VAL-DETAIL-001` is too loose as written; it should explicitly start from `/bookings/[bookingId]?access_token=...`, pass through `/bookings/recover`, and prove the final URL is token-free after cookie handoff.
- `VAL-DETAIL-003` is too broad; “shared summary-and-actions pattern” could pass even if the mobile detail action hierarchy regressed. It should name the current action set and placement: summary actions, mobile inline PDF/Share row, and manage stack ordered as `Modify Details`, `Cancel Booking`, then `Book Again`.
- `VAL-DETAIL-004` is too shallow; “selected code” only checks one recovery-error case, while the page has five supported codes plus an unknown-code fallback. The assertion should require all current codes or at least a representative matrix including fallback behavior.

## Suggested Contract Edits

- Add a public-detail unauthenticated redirect assertion for `/bookings/[bookingId]`.
- Add a guest-detail unauthenticated redirect assertion for `/guest/bookings/[bookingId]`.
- Add a route-level assertion for legacy `?token=` detail links reaching `LEGACY_TOKEN_DEPRECATED`.
- Add a recovery-route assertion covering `next` sanitization and token-to-error-code mapping on `/bookings/recover`.
- Expand the shared-detail assertion to check exact mobile action hierarchy and back-navigation affordance, not just generic shell similarity.
- Expand the recovery-error assertion into a code matrix that includes unknown-code fallback.

## Evidence

- `src/app/(public)/bookings/[bookingId]/page.tsx:82-103` strips `access_token`, rejects legacy `token`, and redirects signed-out users without `sr_access`.
- `src/app/(public)/bookings/[bookingId]/page.tsx:100-120` grants public detail access on cookie presence alone, without validating the recovery token first.
- `src/app/(public)/bookings/booking-page.tsx:88-125` is the shared detail gate used by guest detail and preserves `pathPrefix` in its sign-in redirect.
- `src/app/guest/bookings/[bookingId]/page.tsx:7` mounts the shared detail implementation at `/guest/bookings/[bookingId]`.
- `src/app/(public)/bookings/recover/error/page.tsx:15-50` defines five explicit recovery codes and an unknown-code fallback to `INVALID_ACCESS_TOKEN`.
- `src/components/features/booking/ui/BookingComponents.tsx:33,151,205` defines the default back target plus the desktop/mobile action slots the current UI relies on.
- `src/components/features/booking/detail/ReservationDetailClient.tsx:361,483-495` shows the current failure fallback and the exact manage action hierarchy on detail.
- `src/app/api/bookings/[id]/route.ts:847-908` validates recovery tokens at fetch time and can surface `INVALID_ACCESS_TOKEN`, `ACCESS_TOKEN_EXPIRED`, or `FORBIDDEN` after the page has already admitted the session.
- `tests/e2e/guest-booking-manage.spec.ts:239`, `tests/e2e/guest-public-pages.spec.ts:18`, and `tests/e2e/guest-portal-redirects.spec.ts:12` show today’s automated coverage is thin in this area: manage alias redirect, one recovery-error copy case, and a guest-detail sign-in redirect check.
