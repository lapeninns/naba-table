---
task: time-slot-selection-bug
timestamp_utc: 2025-12-10T11:39:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify components/APIs for date & time selection.

## Core

- [x] Reproduce error and trace state updates when changing time after date selection.
- [x] Fix availability validation to refresh/clear on date or time change.
- [x] Ensure new time selection uses latest availability data.

## UI/UX

- [x] Error message clears when user changes selection.
- [x] Loading/disabled states accurate.

## Tests

- [ ] Add/adjust tests for date change followed by time change.
- [ ] Run existing test suite.

## Notes

- Assumptions:
- Deviations:

## Batched Questions

-
