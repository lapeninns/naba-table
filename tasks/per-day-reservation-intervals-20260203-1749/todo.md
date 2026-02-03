---
task: per-day-reservation-intervals
timestamp_utc: 2026-02-03T17:49:04Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Create migration for `restaurant_operating_hours.reservation_interval_minutes` and `reservation_slot_times`.
- [ ] Add shared interval min/max constants.

## Core

- [ ] Update operating hours server logic and API schemas.
- [ ] Update schedule computation to use effective interval.
- [ ] Update Ops services/types to include interval.

## UI/UX

- [ ] Add interval and slot times inputs to Operating Hours UI.
- [ ] Update Ops floor plan timeline to use effective interval.

## Tests

- [ ] Manual API checks (hours + schedule).
- [ ] Manual UI checks (Operating Hours, floor plan).
- [ ] Chrome DevTools MCP QA artifacts.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None.
