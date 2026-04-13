# Surface: Booking Detail and Recovery

## User Actions

- Open `/bookings/[bookingId]` from a signed-in session or a recovery email link; `access_token` is immediately funneled through `/bookings/recover` so the token does not remain in the final detail URL.
- Open `/bookings/[bookingId]/manage`; it is a legacy alias that redirects to canonical `/bookings/[bookingId]` while preserving query parameters.
- From booking detail, navigate back, download the PDF, share the booking, modify details, cancel the booking, or book again when actions are allowed.
- If no signed-in user or recovery cookie is present, the user is redirected to `/auth/signin?redirectedFrom=<current detail path>`; the guest-portal variant uses `/guest/bookings/[bookingId]` as its return path.
- On `/bookings/recover/error`, the available recovery actions are limited to `Sign in` and `Return home`.

## Assertions To Cover

- Suggested ID: VAL-DETAIL-001
  - Title: Public booking detail consumes recovery link tokens without leaving them in the final URL
  - Behavior: Visiting `/bookings/[bookingId]?access_token=...` should redirect through `/bookings/recover`, set the recovery cookie, then land on `/bookings/[bookingId]` with detail content loaded and manage-capable UI available.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/[bookingId]/page.tsx`, `src/app/(public)/bookings/recover/route.ts`, `src/components/features/booking/detail/ReservationDetailClient.tsx`
- Suggested ID: VAL-DETAIL-002
  - Title: Public manage alias canonicalizes to the detail page without dropping query state
  - Behavior: Visiting `/bookings/[bookingId]/manage` should redirect to `/bookings/[bookingId]` and preserve all existing query parameters so recovery-token and legacy-token handling still occurs on the canonical page.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/[bookingId]/manage/page.tsx`, `src/app/(public)/bookings/[bookingId]/page.tsx`
- Suggested ID: VAL-DETAIL-003
  - Title: Public detail unauthenticated redirects stay on the guest/public auth surface
  - Behavior: Without a signed-in user or `sr_access` cookie, `/bookings/[bookingId]` should redirect to `/auth/signin?redirectedFrom=/bookings/[bookingId]`, and successful guest auth should return to the same public detail path rather than the ops subdomain.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/[bookingId]/page.tsx`, `src/app/(public)/auth/signin/page.tsx`, `lib/url/withRedirectedFrom.ts`
- Suggested ID: VAL-DETAIL-004
  - Title: Signed-in guest detail keeps guest-portal destination context
  - Behavior: `/guest/bookings/[bookingId]` should use the shared detail implementation but redirect unauthenticated users to `/auth/signin?redirectedFrom=/guest/bookings/[bookingId]` and preserve that guest return target after sign-in.
  - Tool: agent-browser
  - Evidence: `src/app/guest/bookings/[bookingId]/page.tsx`, `src/app/(public)/bookings/booking-page.tsx`
- Suggested ID: VAL-DETAIL-005
  - Title: Detail page preserves the current mobile action hierarchy inside the shared guest shell
  - Behavior: Both public and guest detail pages should render inside the same guest shell; on mobile, PDF and Share should move into the inline action row below the info panels, while the manage stack remains ordered as primary `Modify Details`, secondary `Cancel Booking`, then tertiary `Book Again`.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/layout.tsx`, `src/app/guest/layout.tsx`, `src/components/layouts/GuestLayout.tsx`, `src/components/features/booking/ui/BookingComponents.tsx`, `src/components/features/booking/detail/ReservationDetailClient.tsx`
- Suggested ID: VAL-DETAIL-006
  - Title: Recovery error screen shows exact failure copy by code with fixed CTA set
  - Behavior: `/bookings/recover/error?code=...` should show the current title/body pair for each supported code, unknown codes should fall back to the invalid-link message, and the only CTAs should remain `Sign in` and `Return home`.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/recover/error/page.tsx`
- Suggested ID: VAL-DETAIL-007
  - Title: Recovery endpoint sanitizes redirect targets and maps token failures to the current error routes
  - Behavior: `/bookings/recover` should send missing, unconfigured, invalid, and expired tokens to their respective error codes; invalid or external `next` values should collapse to `/`; successful recovery should issue an httpOnly `sr_access` cookie before redirecting.
  - Tool: agent-browser
  - Evidence: `src/app/(public)/bookings/recover/route.ts`
- Suggested ID: VAL-DETAIL-008
  - Title: Action gating and read-only fallbacks stay consistent on detail
  - Behavior: `Modify Details` and `Cancel Booking` should be disabled for cancelled bookings, locked pending bookings, past bookings, or non-manageable sessions; `Book Again` should remain the tertiary action when manage access exists; history should only render when manage access exists; fetch failures should show the shared retry/dashboard error card.
  - Tool: agent-browser
  - Evidence: `src/components/features/booking/detail/ReservationDetailClient.tsx`, `reserve/features/reservations/wizard/api/useReservation.ts`, `src/components/features/booking/detail/ReservationHistory.tsx`

## Edge Cases / Boundaries

- `token` query params are treated as deprecated legacy links and immediately route to `LEGACY_TOKEN_DEPRECATED`; only `access_token`/`accessToken` feed the recovery flow.
- The recovery gate on the page only checks for the presence of `sr_access`, but the booking and history APIs still validate expiry and booking ownership, so stale or mismatched cookies degrade into API-driven error states.
- The shared summary back button defaults to `/guest/dashboard`, including on the public `/bookings/[bookingId]` surface.
- `/bookings/recover/error` ignores the `reason` query param for copy selection; only `code` changes the messaging.
- Recovery error handling does not offer a “request a new link” button; the page preserves today’s narrower CTA set.
- `next` accepts only single-slash relative paths; empty, absolute, or protocol-relative values sanitize to `/`.

## Implementation Clues

- `src/app/(public)/bookings/[bookingId]/page.tsx` is the canonical public detail gate for recovery-token, legacy-token, auth-cookie, and prefetch behavior.
- `src/app/(public)/bookings/[bookingId]/manage/page.tsx` is the legacy manage redirect and should stay behaviorally thin.
- `src/app/(public)/bookings/recover/route.ts` owns redirect sanitization, cookie issuance, and token-to-error-code mapping.
- `src/app/(public)/bookings/recover/error/page.tsx` is the source of truth for recovery failure copy and CTA count.
- `src/app/(public)/bookings/booking-page.tsx` is the shared guest/public booking detail implementation used by `/guest/bookings/[bookingId]`.
- `src/components/features/booking/detail/ReservationDetailClient.tsx` controls responsive action placement, disable rules, offline messaging, history visibility, and detail error handling.
- `src/components/features/booking/ui/BookingComponents.tsx` defines the shared detail shell, back affordance, and desktop-vs-mobile action slots.
- `src/app/(public)/auth/signin/page.tsx` preserves `/bookings` redirects on the public host while reserving app-host reroutes for ops destinations only.
- `src/app/(public)/bookings/layout.tsx`, `src/app/guest/layout.tsx`, and `src/components/layouts/GuestLayout.tsx` define the shared navbar/footer shell expectations across public and signed-in detail contexts.
