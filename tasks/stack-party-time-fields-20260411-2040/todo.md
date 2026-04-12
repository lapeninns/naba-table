---
task: stack-party-time-fields
timestamp_utc: 2026-04-11T20:40:50Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify the canonical booking edit surface and nearest AGENTS rules.
- [x] Create the task folder and note the likely verification surface.

## Core

- [x] Update `ScheduleAwareTimestampPicker` so party size and time no longer render in shared columns.
- [x] Keep the existing field behavior and error handling intact.

## UI/UX

- [x] Confirm the stacked layout reads cleanly in the ops edit dialog.
- [x] Confirm keyboard and focus behavior still work.

## Tests

- [x] Lint the touched component(s).
- [x] Manual Chrome DevTools verification with artifacts.

## Notes

- Assumptions:
- The user is referring to the edit booking dialog surface powered by `ScheduleAwareTimestampPicker`.

- Deviations:
- The ops bookings dev harness still returns schedule and calendar-mask `404` responses for `dev-restaurant`, so verification focused on layout and focus order rather than live availability interactions.

## Batched Questions

- None.
