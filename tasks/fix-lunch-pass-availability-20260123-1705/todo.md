---
task: fix-lunch-pass-availability
timestamp_utc: 2026-01-23T17:05:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Identify slot generation logic for service periods.
- [ ] Confirm Sunday lunch configuration (start/end, duration, buffer).

## Core

- [ ] Fix slot disabling logic for mid-window times.
- [ ] Ensure server validation aligns with UI availability.

## UI/UX

- [ ] Verify 15:15 appears enabled for lunch on Sundays.
- [ ] Confirm no out-of-period slots become enabled.

## Tests

- [ ] Unit
- [ ] Integration
- [ ] E2E / UI smoke
- [ ] Axe/Accessibility checks (if UI changes)

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- ...
