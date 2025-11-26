---
task: lint-hook-cleanup
timestamp_utc: 2025-11-26T16:01:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect lint error locations to confirm intent.

## Core

- [x] Remove unused `reservationKeys` variable in `StepPrefetchBoundary.tsx`.
- [x] Move `useGlobalShortcuts` to unconditional position in `OperatingHoursSection.tsx`.
- [x] Move `useGlobalShortcuts` to unconditional position in `ServicePeriodsSection.tsx`.
- [x] Add typed generics to `debounce`/`throttle` to remove `any` usage.

## Tests

- [x] Run eslint on touched files / repo.

## Notes

- Assumptions: No behavioral changes required; shortcut hooks can safely be invoked early with disabled flag.
- Deviations: None.

## Batched Questions

- None.
