---
task: brand-migration-nabatable
timestamp_utc: 2025-11-24T13:05:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create/extend components (Shadcn-first; exception noted if any) — n/a, copy updates only
- [ ] Add feature flag <flag_name> (default off) — not needed for copy change

## Core

- [x] Update global config (name/description/domain/email branding)
- [x] Refresh SEO defaults (creator/author)
- [x] Replace marketing and UI copy with Nab a Table / Lapen Inns branding
- [x] Update docs/templates (.env, README, security/routing) and package metadata
- [x] Refresh testimonials/features to remove Shipfast/Marc references
- [ ] Data fetching / mutations — n/a
- [ ] Validation & error surfaces — n/a
- [ ] URL/state sync & navigation — unchanged

## UI/UX

- [ ] Responsive layout (spot-check after copy updates)
- [ ] Loading/empty/error states
- [ ] A11y roles, labels, focus mgmt

## Tests

- [x] Unit / integration (pnpm test)
- [ ] E2E (critical flows)
- [ ] Axe/Accessibility checks (during manual QA)

## Notes

- Assumptions:
- Domain assumed `nabatable.com`; Twitter handle assumed `@nabatable`.
- Parent brand to display as “Lapen Inns”.
- Deviations:
- None noted yet.

## Batched Questions

- ...
