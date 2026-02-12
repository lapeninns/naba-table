---
task: fix-floor-plan-new-booking-links
timestamp_utc: 2026-02-12T15:23:48Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Floor Plan New Booking Link Broken

## Requirements

- Clicking "New booking" from `/app/floor-plan` must navigate to the Ops new booking wizard route.
- Clicking "Browse bookings" from `/app/floor-plan` must navigate to Ops bookings.
- Preserve query params behavior: date/time/partySize continue to prefill the wizard.

## Root Cause

`FloorPlanPage` used `router.push('/new-bookings?...')` and `router.push('/bookings?...')`.

Ops routes live under the `/app` base path:

- New booking: `/app/new-bookings` (`src/app/app/(app)/new-bookings/page.tsx`)
- Bookings: `/app/bookings`

`/new-bookings` is a 404, so the navigation appears broken.

## Recommended Direction

Use the canonical Ops base path (`/app`) for navigation from floor plan:

- `router.push('/app/new-bookings?...')`
- `router.push('/app/bookings?...')`
