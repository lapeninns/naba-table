---
task: reserve-bookingwizard-unused-var
timestamp_utc: 2025-12-05T15:44:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect `BookingWizard.tsx` to confirm `isSessionReady` is unused.

## Core

- [x] Remove `isSessionReady` declaration and any dependent code (none expected).

## Tests

- [x] Run `pnpm eslint reserve/features/reservations/wizard/ui/BookingWizard.tsx --max-warnings=0`.

## Notes

- Assumptions: Engine warning (Node 22 vs 20.11.1) acceptable for lint run.
- Deviations: None yet.
