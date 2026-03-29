---
task: operating-hours-override-calendar
timestamp_utc: 2026-03-29T17:28:38Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect operating-hours override UI and shared calendar patterns
- [x] Create task folder and artifacts

## Core

- [x] Add a shared-pattern override date picker for operating hours
- [x] Replace native override date input with the shared calendar control
- [x] Keep existing validation and payload formatting unchanged

## UI/UX

- [x] Preserve focus, keyboard interaction, and inline error messaging
- [x] Match shared calendar trigger styling used elsewhere in the product

## Tests

- [x] Run a focused code check
- [x] Verify in browser via dev harness / settings route

## Notes

- Assumptions:
  - The requested mismatch refers to the override date field using a native browser picker instead of the shared popover calendar.
- Deviations:
  - Prettier reformatted the touched settings file while keeping the implementation scoped to the override date control.

## Batched Questions

- None.
