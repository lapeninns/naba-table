---
task: fix-guest-active-bookings
timestamp_utc: 2026-02-08T16:40:57Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm existing guest bookings query flow and filters.

## Core

- [x] Add per-restaurant timezone filtering for `status=active` in `handleMyBookings`.
- [x] Apply pagination after filtering; ensure `total` and `hasNext` are consistent.

## Tests

- [ ] Manual spot-check for active bookings filtering (past vs upcoming).

## Notes

- Assumptions: Guest booking counts are small enough for in-memory filtering.
- Deviations: None.
