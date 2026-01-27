---
task: fix-booking-hydration
timestamp_utc: 2026-01-27T09:39:49Z
owner: github:@codex
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: [90787006]
---

# Research: Fix Booking Hydration Error

## Requirements

- Functional:
- Eliminate hydration mismatch on `/bookings/[id]` in production.
- Maintain existing booking details UX and data correctness.

- Non-functional (a11y, perf, security, privacy, i18n):
- Preserve SSR benefits; avoid client-only fallbacks unless justified.
- Ensure deterministic SSR/CSR rendering (no time/random/browser-only differences).
- No regression in accessibility semantics or focus order.

## Existing Patterns & Reuse

- Route composition: `src/app/(public)/bookings/[bookingId]/page.tsx` prefetches and hydrates React Query state.
- Client render: `src/components/features/booking/detail/ReservationDetailClient.tsx`.
- Shared, deterministic date formatting already exists: `reserve/shared/formatting/booking.ts` uses `Intl.DateTimeFormat('en-GB', { timeZone })`.

## External Resources

- Not required yet; will consult Next.js hydration guidance if root cause is unclear.

## Constraints & Risks

- Hydration issues often arise from `Date`, randomness, locale differences, or browser-only globals.
- Route is user-facing in production; fix must be scoped and safe.
- Observed non-determinism risks in current code:
- `Intl.DateTimeFormat(undefined, ...)` in `ReservationDetailClient` and `ReservationHistory` can differ across SSR/CSR locales/timezones.
- `Date.now()` is used during initial render (`clockNow` state initializer and `isPastReservation`), which can diverge between SSR and hydration.

## Open Questions (owner, due)

- Q: Which component in the booking page produces non-deterministic markup?
  A: Likely `ReservationDetailClient` and nested `ReservationHistory` due to default-locale `Intl` and render-time `Date.now()`.

## Recommended Direction (with rationale)

- Make SSR/CSR deterministic in the canonical booking detail path:
- Pass a server-generated `initialNow` timestamp from `page.tsx` into `ReservationDetailClient` to eliminate render-time clock drift at hydration.
- Replace default-locale/timezone `Intl.DateTimeFormat(undefined, ...)` with shared `reserve/shared/formatting/booking` helpers using explicit locale and venue timezone.
