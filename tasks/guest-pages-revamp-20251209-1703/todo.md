---
task: guest-pages-revamp
timestamp_utc: 2025-12-09T17:03:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create/extend components (Shadcn-first; exception noted if any) — added guest design-system utility layer.
- [x] Add feature flag feat.guest.revamp (default off) — not needed (styling-only); documented.

## Core

- [ ] Data fetching / mutations
- [ ] Validation & error surfaces
- [ ] URL/state sync & navigation

## UI/UX

- [x] Responsive layout
- [x] Loading/empty/error states
- [x] A11y roles, labels, focus mgmt

## Tests

- [ ] Unit
- [ ] Integration
- [ ] E2E (critical flows)
- [ ] Axe/Accessibility checks

## Notes

- Assumptions: Light-mode only; reuse existing assets/content.
- Deviations: Skipped feature flag (visual-only); changes scoped to guest layouts + pages.

## Batched Questions

- ...
