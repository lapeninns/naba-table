---
task: fix-edit-period-slots
timestamp_utc: 2026-01-23T08:18:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review existing schedule edit flow and synthetic slot logic.

## Core

- [x] Update `mergeWithSyntheticSlots` to prevent synthetic slots from being treated as available.
- [x] Add `endMinutes > startMinutes` validation to `buildCoverage`.
- [x] Remove `buildAvailability` fallback.

## UI/UX

- [ ] Confirm time suggestions omit out-of-period gaps.

## Tests

- [x] Run tests (`pnpm test`).

## Notes

- Assumptions:
  - No legacy out-of-period bookings exist.
- Deviations:

## Batched Questions

- Should legacy out-of-period bookings remain selectable in edit flow? Answered: block out-of-period times.
