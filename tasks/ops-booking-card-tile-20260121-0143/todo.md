---
task: ops-booking-card-tile
timestamp_utc: 2026-01-21T01:43:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review existing OpsBookingCard structure and booking state logic

## Core

- [x] Replace luxon with native Date/Intl in OpsBookingCard
- [x] Build memoized meta object for display logic

## UI/UX

- [x] Status rail with state-based color
- [x] InfoTiles grid + notes highlight
- [x] Header layout adjustments
- [x] Primary action bottom-right; secondary actions in dropdown
- [x] Hover shadow + responsive spacing

## Tests

- [ ] Manual UI QA via Chrome DevTools MCP

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None
