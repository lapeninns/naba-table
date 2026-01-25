---
task: fix-ops-booking-null-times
timestamp_utc: 2026-01-25T11:08:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify normalization logic for ops booking times

## Core

- [x] Ensure startIso/endIso are valid when times are null
- [ ] Guard date formatting if needed

## UI/UX

- [ ] Verify no crashes for null times

## Tests

- [ ] Add/adjust tests if applicable

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- What is the intended fallback time display for nulls? (Using midnight `00:00:00` unless you prefer a different label.)
