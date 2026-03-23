---
task: old-crown-weekend-slot-alignment
timestamp_utc: 2026-03-23T12:33:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Capture current Old Crown restaurant config.
- [x] Capture current lunch occasion availability.

## Core

- [x] Update Old Crown interval to `30`.
- [x] Update lunch availability to `11:30-17:00`.
- [x] Add canonical migration for the lunch occasion update.
- [x] Remove duration/buffer-based trimming from schedule slot generation.
- [x] Align guest and ops booking-time validation with configured slot boundaries.
- [x] Align picker/manual-time helpers with the last configured slot instead of derived guard minutes.

## UI/UX

- [x] No direct UI changes.

## Tests

- [x] Re-query Friday schedule.
- [x] Re-query Saturday schedule.
- [x] Re-query Sunday schedule.
- [x] Add regression coverage for exclusive-end service slots.
- [x] Add regression coverage for accepting the last configured slot.

## Notes

- Assumptions:
  - Shared lunch availability should match the existing weekend lunch service-period model already used by multiple restaurants.
- Deviations:
  - Immediate live correction is being applied before a formal staged migration because the user asked for an urgent config fix.
  - The task expanded into a code alignment pass so slot generation, validation, and picker helpers all follow the same config-driven rule.

## Batched Questions

- None currently.
