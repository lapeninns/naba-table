---
task: restaurant-onboarding-wizard
timestamp_utc: 2025-12-02T07:46:28Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: high
flags: [feat.onboarding-wizard]
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create task folder, research, plan
- [x] Enable feature flag plumbing and CSRF on signup

## Core

- [x] Implement `/api/auth/signup` with CSRF + rate limit + password/magic link
- [x] Add onboarding API endpoints (restaurant create, hours, service periods, zones, tables, complete)
- [x] Build onboarding route group with steps (profile, hours, services, tables, review)
- [x] Replace `/auth/signup` placeholder with functional signup form

## UI/UX

- [x] Onboarding wizard shell + progress
- [x] Profile form reuse
- [x] Hours + service periods steps reuse ops components
- [x] Zones/tables simplified editor and review summary

## Tests

- [ ] Unit
- [ ] Integration
- [ ] E2E (critical flows)
- [ ] Axe/Accessibility checks

## Notes

- Assumptions:
- Deviations:

## Batched Questions

-
