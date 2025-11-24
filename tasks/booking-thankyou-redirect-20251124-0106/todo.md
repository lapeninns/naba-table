---
task: booking-thankyou-redirect
timestamp_utc: 2025-11-24T01:06:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Locate booking completion flow and Thank You route/component.
- [ ] Confirm existing redirect helpers or router utilities.

## Core

- [x] Adjust booking confirmation cookie path in `POST /api/bookings` to be readable by `/api/bookings/confirm`.
- [x] Ensure confirm endpoint clears cookie using same path.
- [x] Update Thank You page to fetch confirmation even when no `token` query is present (cookie fallback).

## UI/UX

- [ ] Keep accessibility intact; confirm focus/navigation post-redirect.
- [ ] Validate loading/error states unaffected.

## Tests

- [ ] Manual pending path -> Thank You.
- [ ] Manual confirmed via close confirmation -> Thank You.
- [ ] (Optional) Add/adjust automated test if harness exists.

## Notes

- Assumptions: Thank You page already exists; if not, will identify alternative.
- Deviations: None yet.

## Batched Questions

- None yet.
