---
task: fix-dashboard-realtime-move-invalidation
timestamp_utc: 2026-03-19T15:44:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm the regression and locate the affected realtime payload matcher
- [x] Create task artifacts for the bugfix

## Core

- [x] Update realtime payload matching to consider both old and new row identities
- [x] Keep invalidation scope narrow to the active restaurant/date
- [x] Add focused regression coverage for moved bookings

## Tests

- [x] Run focused regression checks
- [x] Run `pnpm typecheck`

## Notes

- Assumptions:
  - Supabase `postgres_changes` payloads may include both `old` and `new` row values for updates.
- Deviations:
  - The pure payload-matching helper was added to the existing realtime invalidation utility file rather than a brand-new utility file to keep the fix compact and colocated with the related debounce helper.

## Batched Questions

- None at the moment.
