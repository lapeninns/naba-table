---
task: booking-table-delete-404
timestamp_utc: 2025-11-24T16:40:38Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm no additional AGENTS files apply (done)
- [x] No feature flag needed

## Core

- [x] Point ops booking service to `/api/ops/bookings`
- [x] Add unit test guarding unassign path
- [x] Run relevant tests

## UI/UX

- [ ] Responsive layout
- [ ] Loading/empty/error states
- [ ] A11y roles, labels, focus mgmt

## Tests

- [ ] Unit
- [ ] Integration
- [ ] E2E (critical flows)
- [ ] Axe/Accessibility checks

## Notes

- Assumptions:
- Deviations: No DB changes; using existing ops routes

## Batched Questions

- None currently
