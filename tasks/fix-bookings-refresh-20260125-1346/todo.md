---
task: fix-bookings-refresh
timestamp_utc: 2026-01-25T13:46:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify bookings screen(s) and data fetching path
- [x] Confirm desired refresh behavior

## Core

- [x] Implement refresh strategy
- [x] Ensure cache invalidation on focus/reconnect or mutation

## UI/UX

- [ ] Loading/empty/error states preserved
- [ ] A11y unaffected

## Tests

- [ ] Unit
- [ ] Integration
- [ ] E2E (critical flows)
- [ ] Axe/Accessibility checks

## Notes

- Assumptions:
- Deviations:

## Batched Questions

- ...
