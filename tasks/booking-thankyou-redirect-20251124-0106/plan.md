---
task: booking-thankyou-redirect
timestamp_utc: 2025-11-24T01:06:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking thank-you redirect

## Objective

Ensure users are redirected to the Thank You page whenever a booking completes, covering both pending and confirmed flows, with confirmed bookings redirecting via the close-confirmation action.

## Success Criteria

- [ ] Completing a booking that becomes pending redirects to Thank You page automatically.
- [ ] Completing a booking that becomes confirmed redirects via close confirmation and reaches Thank You page.
- [ ] No regressions in booking flow; navigation remains accessible (keyboard/semantics unchanged).

## Architecture & Components

- Booking completion already uses `handleClose` in `useReservationWizard` to navigate to `safeReturnPath` (defaults to `/thank-you`).
- Thank You page (`src/app/(marketing)/thank-you/page.tsx`) should request `/api/bookings/confirm` even without a `token` query so it can use the ephemeral cookie.
- Booking creation API (`src/app/api/bookings/route.ts`) should set the confirmation cookie path to `/api/bookings/confirm` and clear it from that path in the confirm handler.

## Data Flow & API Contracts

- Keep existing booking submission flow; adjust response handling only by cookie path.
- Thank You page fetches `/api/bookings/confirm` with `credentials: 'same-origin'`; API should receive the `sr_confirm` cookie due to corrected path, or explicit `token` query when present.

## UI/UX States

- Loading/submission unchanged; post-completion still redirects via `handleClose`/auto-redirect.
- Thank You page should display booking details for both pending and confirmed bookings whether token is in query or cookie.

## Edge Cases

- If no cookie/token exists, Thank You page should degrade gracefully to idle state.
- Ensure cookie deletion matches the new path to avoid stale tokens.

## Testing Strategy

- Manual happy path for pending booking -> Thank You.
- Manual happy path for confirmed booking via close confirmation -> Thank You.
- Verify no redirect on error.
- Accessibility: keyboard navigation through confirmation/close confirmation.

## Rollout

- No feature flag anticipated; simple behavior change.
- Monitor booking completion analytics if available (noted post-implementation).

## DB Change Plan (if applicable)

- Not applicable; no DB schema changes expected.
