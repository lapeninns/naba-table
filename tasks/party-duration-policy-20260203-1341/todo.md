---
task: party-duration-policy
timestamp_utc: 2026-02-03T13:41:10Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: [feat.reservation.turn_bands]
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Define data model for turn bands per restaurant/service
- [x] Add/extend ops UI for editing duration rules

## Core

- [x] Read per-restaurant rules in capacity policy
- [x] Validate inputs at API boundary
- [x] Fallback to defaults when undefined

## UI/UX

- [x] Responsive layout
- [x] Loading/empty/error states
- [x] A11y roles, labels, focus mgmt

## Tests

- [x] Unit
- [ ] Integration
- [ ] E2E (critical flows)
- [ ] Axe/Accessibility checks

## Notes

- Assumptions:
- Turn bands defaults surface lunch/dinner service bands when no overrides exist.
- Deviations:

## Batched Questions

- ...
