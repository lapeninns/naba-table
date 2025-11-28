---
task: booking-availability-edit-bug
timestamp_utc: 2025-11-27T23:58:37Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Booking availability editing bug

## Objective

We will enable guests/ops to edit an existing reservation without hitting the "Unable to load availability" error so availability loads correctly and the booking can be updated.

## Success Criteria

- [ ] Editing an existing booking loads availability slots for the associated restaurant and selected date.
- [ ] No "Unable to load availability" error when required restaurant info is present.
- [ ] Regression: existing booking edit flow remains functional for other restaurants.

## Architecture & Components

- Update `GET /api/bookings/[id]` (authenticated path) to include restaurant metadata (slug, name, timezone) similar to token path.
- Keep EditBookingDialog; ensure it receives slug/timezone via existing ReservationDetailClient pipeline.

## Data Flow & API Contracts

- API: `/api/bookings/:id` (auth path) will return `{ booking: { ..., restaurants: { name, slug, timezone } } }`.
- `reservationAdapter` already parses restaurants data; extend normalization to carry timezone for downstream use.

## UI/UX States

- Loading / Empty / Error / Success (reuse existing edit booking modal states).

## Edge Cases

- Logged-in user viewing their booking (no token) must still get slug.
- Booking with missing restaurant slug in DB may still fail; surface graceful error remains acceptable.

## Testing Strategy

- Unit/Integration:
  - Add/adjust tests for `GET /api/bookings/[id]` to assert restaurant metadata is returned on auth path.
  - (If needed) small unit check in adapter for timezone passthrough.
- Manual QA via Chrome DevTools MCP for edit booking modal (desktop + mobile widths).

## Rollout

- Existing feature; no flag expected. If needed, consider temporary guard.

## DB Change Plan (if applicable)

- Not expected.
