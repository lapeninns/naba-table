---
task: ops-ui-consistency
timestamp_utc: 2026-02-04T07:40:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create ops-shell pattern components
- [x] Update task artifacts + CONTINUITY

## Core

- [x] Replace headers/toolbars in ops feature clients with shared patterns
- [x] Remove `transition-all` in ops UI scope
- [x] Align input a11y/focus-visible patterns

## UI/UX

- [x] Ensure sticky toolbars match new pattern
- [x] Keep empty/error states consistent

## Tests

- [x] `pnpm eslint --max-warnings=0 src/components/features/ops-shell src/components/features/dashboard src/components/features/bookings src/components/features/customers src/components/features/seating src/components/features/restaurant-settings src/components/features/tables src/components/features/team`
- [x] `pnpm typecheck`

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None.
