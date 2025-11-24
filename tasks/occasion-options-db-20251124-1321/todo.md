---
task: occasion-options-db
timestamp_utc: 2025-11-24T13:24:36Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Identify current occasion data source and hardcoded values
- [x] Confirm API/service that should supply occasions

## Core

- [x] Replace hardcoded booking-type validation with catalog-backed helper
- [x] Update booking mutation flows to use DB-backed validator
- [ ] Handle loading/error/empty states if applicable

## UI/UX

- [ ] Responsive layout maintained
- [ ] A11y roles/labels/focus unchanged
- [ ] Visual regression minimal

## Tests

- [ ] Update/add unit tests for dynamic data
- [ ] Update storybook/example if needed
- [ ] Axe/Accessibility checks

## Notes

- Assumptions:
- Deviations:

## Batched Questions

-
