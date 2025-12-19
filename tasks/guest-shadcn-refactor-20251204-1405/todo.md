---
task: guest-shadcn-refactor
timestamp_utc: 2025-12-04T14:05:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Add guest UI wrapper components built from Shadcn primitives.
- [ ] Align marketing/guest layouts to wrappers; keep feature flag logic.

## Core

- [x] Home, restaurants list/detail, booking entry use wrappers.
- [x] Guest auth form uses Shadcn Form/Alert.
- [x] Booking list/detail refactored to Shadcn cards/tabs/dialogs.
- [x] Dashboard cards and quick actions on wrappers.
- [x] Profile form uses Shadcn form controls/alerts.

## UI/UX

- [ ] Responsive layout verified.
- [ ] Loading/empty/error states via shared wrappers.
- [ ] A11y roles/labels/focus managed; aria-live for status.

## Tests

- [ ] Add/update unit/spot tests for wrappers where useful.
- [ ] Run lint/tests if time permits.
- [ ] Axe/DevTools checks on key pages.

## Notes

- Assumptions: design keeps current visual direction (light with gradients); no dark mode requirement.
- Deviations: none yet.

## Batched Questions

- Should gradients be retained or simplified? (awaiting design answer)
