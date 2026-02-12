---
task: fix-floor-plan-new-booking-links
timestamp_utc: 2026-02-12T15:23:48Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Plan: Fix Floor Plan New Booking Links

## Objective

Ensure `/app/floor-plan` navigates to the correct Ops routes for creating and browsing bookings.

## Implementation

- Update `src/components/features/seating/FloorPlanPage.tsx`:
  - Replace `/new-bookings` with `/app/new-bookings`
  - Replace `/bookings` with `/app/bookings`
  - Keep query params (date/time/partySize/tableId) unchanged.

## Verification

- Confirm `http://localhost:3000/new-bookings` is not used anywhere for Ops navigation.
- Manual click test from floor plan:
  - New booking button takes you to `/app/new-bookings` (or signin redirect if unauthenticated).
  - Browse bookings takes you to `/app/bookings`.
