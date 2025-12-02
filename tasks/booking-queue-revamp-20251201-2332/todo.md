---
task: booking-queue-revamp
timestamp_utc: 2025-12-01T23:32:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect current ops table/header structure and dependencies.

## Core

- [x] Refactor desktop header layout to reduce whitespace and align filters + result count.
- [x] Add richer ops columns (reference, contact, table assignment summary, capacity delta, notes badge/source) while keeping guest variant stable.
- [x] Update skeletons/empty states if needed for new layout.
- [x] Keep actions compact and consistent.

## UI/UX

- [ ] Ensure responsive behavior down to ~1024px; no overflow.
- [ ] Maintain focus outlines and hit targets.

## Tests

- [ ] Manual desktop sanity (filters, actions clickable, spacing improved).
- [ ] Keyboard tab order through search, filters, row actions.

## Notes

- Assumptions: Mobile list stays as-is.
- Deviations: None yet.

## Batched Questions

- None.
