---
task: fix-auth-memberships
timestamp_utc: 2026-01-23T00:18:11Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Create/extend components (Shadcn-first; exception noted if any)
- [ ] Add feature flag <flag_name> (default off)

## Core

- [x] Data fetching / mutations (memberships via service-role client; remove server getSession)
- [x] Improve membership error logging for Supabase failures
- [ ] Validation & error surfaces
- [ ] URL/state sync & navigation

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
- Deviations:

## Batched Questions

- ...
