---
task: fix-summary-totals
timestamp_utc: 2026-01-19T12:44:09Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review cache update logic for table unassignment

## Core

- [x] Update summary totals when booking status changes
- [x] Ensure non-realtime path refreshes summary if needed

## UI/UX

- [ ] N/A

## Tests

- [x] Add hook test to validate totals update on unassign
- [ ] Manual sanity check if app is runnable

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- None
