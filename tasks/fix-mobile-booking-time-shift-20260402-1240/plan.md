---
task: fix-mobile-booking-time-shift
timestamp_utc: 2026-04-02T12:40:07Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Fix mobile booking time shift

## Objective

We will make the guest bookings list render booking times in the restaurant timezone so that admin-edited bookings remain visible as the intended local time on mobile devices.

## Success Criteria

- [ ] A booking stored as `2026-07-01T18:30:00.000Z` with `Europe/London` timezone renders as `19:30`.
- [ ] A venue-local booking string like `2026-07-01T19:30` also renders as `19:30`.
- [ ] Sorting/upcoming-vs-past classification uses the same timezone-safe parsing path.

## Architecture & Components

- `reserve/shared/formatting/bookingDateTime.ts`: shared timezone-safe parser/normalizer for booking timestamps.
- `src/app/api/bookings/route.ts`: normalize guest booking list API timestamps at the boundary.
- `reserve/entities/reservation/adapter.ts`: normalize reservation fallback `startAt` / `endAt` values with restaurant timezone awareness.
- `src/components/features/booking/list/BookingListClient.tsx`: canonical guest list surface.
- `src/components/features/guest/dashboard/GuestDashboardClient.tsx` and `src/components/features/guest/dashboard/booking-derivations.ts`: consistent upcoming/live calculations and display formatting.
- `src/app/guest/bookings/[bookingId]/receipt/ReceiptClient.tsx` and `src/components/features/booking/detail/ReservationDetailClient.tsx`: guest detail/receipt rendering consistency.
- Tests:
  - `tests/components/BookingListClient.test.tsx`
  - `tests/guest/bookingDateTime.test.ts`
  - `tests/guest/reservationAdapter.test.ts`
  - `tests/guest/booking-derivations.test.ts`

## Data Flow & API Contracts

Input shape from guest bookings service:

- `startIso: string`
- `restaurantTimezone?: string | null`

Display handling:

- If `startIso` has an explicit offset, parse it as an instant and convert to `restaurantTimezone`.
- If `startIso` has no explicit offset, parse it directly in `restaurantTimezone`.

Normalization changes:

- `/api/bookings` now prefers stored `start_at` / `end_at` and falls back to timezone-aware UTC ISO derivation when only `booking_date` + `start_time` exist.
- reservation adapter fallback now uses the restaurant timezone instead of browser-local `Date` parsing.

## UI/UX States

- Existing loading/empty/error/success states stay unchanged.
- Only the displayed month/day/time labels and time-based ordering logic change.

## Edge Cases

- Missing timezone: fall back to `Europe/London`.
- Invalid timestamp: keep a minimal fallback display instead of crashing.
- DST transitions: venue-local `date + time` must map to the correct UTC instant.

## Testing Strategy

- Component test for explicit-offset ISO (`...Z`) -> venue-local display.
- Component test for venue-local timestamp string stability.
- Unit test for shared booking datetime normalization.
- Unit test for reservation adapter timezone fallback.
- Unit test for guest dashboard derivation ordering with venue-local timestamps.

## Rollout

- No feature flag required; this is a contained regression fix.
- Monitoring: manual guest bookings smoke test on mobile viewport via Chrome DevTools.
- Kill-switch: revert the component-level parsing helper if unexpected regressions appear.
