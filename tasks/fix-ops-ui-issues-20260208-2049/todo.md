---
task: fix-ops-ui-issues
timestamp_utc: 2026-02-08T20:49:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Update continuity ledger.

## Core

- [x] Fix `getStatusLabel` to use canonical ops labels when available.
- [x] Add trusted origin helpers and remove header-derived origins.
- [x] Fix heatmap calendar date construction to avoid timezone drift.

## UI/UX

- [x] Wire "Filter bookings" button to a deterministic action.
- [x] Fix skeleton divider visibility.

## Tests

- [ ] Smoke check relevant screens (if possible).

## Notes

- Assumptions:
  - Env vars provide correct public origins for server-side prefetches.
- Deviations:
  - None.

## Batched Questions

- None.
