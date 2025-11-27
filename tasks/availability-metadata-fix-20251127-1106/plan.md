---
task: availability-metadata-fix
timestamp_utc: 2025-11-27T11:06:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Restore availability metadata for booking edits

## Objective

Ensure Edit Booking dialogs always receive restaurant slug/timezone so availability loads correctly after switching restaurants.

## Success Criteria

- Ops booking edit dialog no longer shows the "missing restaurant information" alert when a restaurant is selected.
- Availability grid loads for ops bookings with correct interval settings.
- TypeScript builds cleanly; ops booking APIs return slug/timezone fields.

## Architecture & Components

- API: `/api/ops/bookings` list route – include slug/timezone in select & response mapping.
- API: `/api/ops/bookings/[id]` patch responses – include restaurant metadata.
- Types: `OpsBookingListItem` (+ dependent `OpsBookingsPage`).
- Client: `OpsBookingsClient` mapping -> `EditBookingDialog` props.

## Data Flow & Contracts

- Supabase select adds `restaurants(slug, timezone, reservation_interval_minutes, name)`.
- API response objects carry `restaurantSlug`, `restaurantTimezone`, `reservationIntervalMinutes`.
- Front-end maps these onto `BookingDTO` passed to `EditBookingDialog` (fallback to active membership only if missing).

## Edge Cases

- Membership without slug but restaurant record has slug – should still work via API data.
- Booking without restaurant relation (unlikely) – fallback remains to membership/null, preserving alert if truly missing.

## Testing Strategy

- Unit/e2e not added; run targeted TypeScript/lint if reasonable.
- Manual sanity: open ops bookings page with a booking and confirm edit dialog enables availability (pending DevTools MCP as follow-up in verification).

## Rollout

- No flags; immediate effect. Monitor for API contract regressions in ops booking consumers.
