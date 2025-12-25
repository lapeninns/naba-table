---
task: guest-booking-self-edit
timestamp_utc: 2025-12-25T23:28:37Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Reuse existing components (no new UI components required)
- [ ] Add feature flag (not required)

## Core

- [x] Data fetching / mutations
- [x] Validation & error surfaces
- [x] URL/state sync & navigation (no changes)

## UI/UX

- [ ] Responsive layout (no changes)
- [ ] Loading/empty/error states (no changes)
- [ ] A11y roles, labels, focus mgmt (manual QA pending)

## Tests

- [x] Unit/route tests added for guest ownership
- [ ] Integration
- [ ] E2E (critical flows)
- [ ] Axe/Accessibility checks

## Notes

- Assumptions: guest ownership validated by email or auth_user_id; recovery token remains valid path.
- Deviations: none.

## Batched Questions

- None.
