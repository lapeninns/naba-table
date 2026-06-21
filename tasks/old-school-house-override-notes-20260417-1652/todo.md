---
task: old-school-house-override-notes
timestamp_utc: 2026-04-17T16:52:21Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify the production Old School House restaurant row.
- [x] Snapshot the current production operating-hours rows.
- [x] Confirm the exact target override date span with the user.

## Core

- [x] Clear notes from all seven weekly rows.
- [x] Create or update per-date override rows for the confirmed target dates.
- [x] Preserve hours, closure state, interval, and slot-time fields.

## Tests

- [x] Capture before/after production snapshots.
- [x] Verify the override dates and notes match the confirmed request.

## Notes

- Assumptions:
  - The desired note text is exactly: `Open for drinks only for now. Food service is paused while the kitchen offer gets ready.`
- Deviations:
  - The final confirmed window is Friday `2026-04-17` through Thursday `2026-04-23`, with food returning on Friday `2026-04-24`.

## Batched Questions

- None.
