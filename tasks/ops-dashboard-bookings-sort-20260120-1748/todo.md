---
task: ops-dashboard-bookings-sort
timestamp_utc: 2026-01-20T17:48:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review existing dashboard list sort logic.

## Core

- [x] Implement grouped sort for “All” filter (checked-in → upcoming → completed).
- [x] Preserve current sort controls within each group.

## UI/UX

- [ ] Verify list ordering with mixed statuses.

## Tests

- [ ] Manual UI check on dashboard.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None.
