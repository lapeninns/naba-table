---
task: edit-booking-scroll
timestamp_utc: 2025-12-02T01:40:03Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Locate edit booking modal component and confirm styling source.

## Core

- [x] Add vertical scroll capability to modal body with viewport-based max height.
- [x] Ensure header/close button stay visible and focus order preserved.

## UI/UX

- [ ] Verify desktop and smaller viewport behaviors (no background scroll bleed).

## Tests

- [ ] Run relevant lint/tests if present (smoke).

## Notes

- Assumptions: Using existing modal primitives and tailwind/utility classes.
- Deviations: N/A yet.
