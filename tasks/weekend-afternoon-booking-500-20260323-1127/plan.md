---
task: weekend-afternoon-booking-500
timestamp_utc: 2026-03-23T11:27:26Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Weekend afternoon public booking failure

## Objective

We will keep public booking submissions aligned with the restaurant schedule so weekend 15:00-17:00 slots use the correct booking type and stop failing in the booking API.

## Success Criteria

- [ ] Reservation draft creation preserves an explicitly selected booking type.
- [ ] Public booking POST canonicalizes the booking type from the validated schedule slot when present.
- [ ] Regression tests cover the preserved booking type behavior.

## Architecture & Components

- `reserve/features/reservations/wizard/model/transformers.ts`: stop overwriting the schedule-selected booking type during submit.
- `src/app/api/bookings/route.ts`: derive the canonical booking type from the matched schedule slot before resolving duration and writing the booking.

## Data Flow & API Contracts

- Request contract unchanged.
- Server behavior changes: when a valid schedule slot exists, `bookingType` is normalized to that slot’s `bookingOption`.

## UI/UX States

- No visual changes.
- Existing booking confirmation and validation flows remain unchanged.

## Edge Cases

- If the slot is not found, preserve existing validation behavior.
- If the client omits `bookingType`, fall back to the existing time-based inference only before schedule canonicalization.

## Testing Strategy

- Unit test `buildReservationDraft()` to ensure it preserves explicit `bookingType`.
- Focused route verification via existing typecheck/lint/test tooling.

## Rollout

- No feature flag change.
- Ship as a focused bug fix in the canonical public booking flow.
