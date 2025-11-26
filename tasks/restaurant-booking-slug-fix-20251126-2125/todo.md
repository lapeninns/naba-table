---
task: restaurant-booking-slug-fix
timestamp_utc: 2025-11-26T21:25:00Z
owner: github:@assistant
reviewers: []
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm slug-based booking entrypoint replicates missing restaurant ID.

## Core

- [x] Hydrate wizard state with `restaurantId` (and related metadata if present) from schedule responses.
- [x] Ensure hydration only updates when slug/schedule changes to avoid loops.

## UI/UX

- [ ] Verify error no longer surfaces on `/restaurants/:slug/book` during booking.

## Tests

- [x] Add unit test covering restaurant ID hydration from schedule.
- [x] Run relevant vitest suite.

## Notes

- Assumptions: Schedule API reliably returns `restaurantId` for valid slugs.
- Deviations: None yet.

## Batched Questions

- None.
