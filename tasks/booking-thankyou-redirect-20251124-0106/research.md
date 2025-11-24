---
task: booking-thankyou-redirect
timestamp_utc: 2025-11-24T01:06:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Booking thank-you redirect

## Requirements

- Functional:
  - When a booking is completed (confirmed or pending confirmation), user should be redirected to a Thank You page.
  - Confirmed booking path should redirect via a "close confirmation" action.
  - Pending booking completion should also trigger Thank You page.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve existing accessibility and performance budgets; redirects should not break navigation.
  - No secrets involved; ensure URL/state updates remain consistent.

## Existing Patterns & Reuse

- Booking flow uses `ReservationWizardClient` → `ReservationWizard` → `BookingWizard` with default `returnPath='/thank-you'`.
- Confirmation actions include "Close confirmation" calling `handleClose` in `useReservationWizard`, which navigates to a `safeReturnPath` (defaults to `/thank-you`).
- Thank You page lives at `src/app/(marketing)/thank-you/page.tsx`; it fetches `/api/bookings/confirm` **only when a `token` query param is present** and otherwise shows a generic idle state.
- Booking creation API (`POST /api/bookings`) sets an `sr_confirm` cookie containing a one-time confirmation token, but the cookie path is `/thank-you`, while `/api/bookings/confirm` expects to read the cookie. Because of the path mismatch, the cookie is not sent to the confirm endpoint, so redirecting to `/thank-you` without a `token` query never loads booking details.

## External Resources

- None yet.

## Constraints & Risks

- Risk of breaking booking flow navigation or state handling.
- Need to ensure both pending and confirmed paths converge without creating loops.

## Open Questions (owner, due)

- Are there existing Thank You page components/routes to reuse? (owner: assistant, due: 2025-11-24)
- How is "close confirmation" currently triggered? (owner: assistant, due: 2025-11-24)

Status: Both answered above (reuse and trigger via `handleClose`).

## Recommended Direction (with rationale)

- Fix PRG path so `/api/bookings/confirm` can consume the `sr_confirm` cookie (likely set cookie path to `/api/bookings/confirm`).
- Let Thank You page fall back to cookie-based confirmation when no `token` query param is present.
- Keep existing redirect triggers (`handleClose`, pending auto-redirect) but ensure they land on `/thank-you` with data resolved.
