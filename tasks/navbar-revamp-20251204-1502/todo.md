---
task: navbar-revamp
timestamp_utc: 2025-12-04T15:02:42Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create unified GuestNavbar (Shadcn primitives) to replace legacy navs
- [x] Remove legacy CustomerNavbar/Header and guestUi flag usage

## Core

- [ ] Wire GuestNavbar into all guest-facing layouts (public, marketing, guest, auth)
- [ ] Ensure sign-out clears query cache and redirects home
- [ ] Keep primary IA: Restaurants link + Reserve CTA; account menu holds protected links

## UI/UX

- [ ] Responsive layout (desktop pills + mobile sheet)
- [ ] Loading skeleton for account trigger
- [ ] A11y roles, labels, focus mgmt + skip link

## Tests

- [ ] Lint/typecheck smoke
- [ ] Manual UI QA (DevTools MCP) incl. keyboard + mobile
- [ ] Axe/Accessibility checks

## Notes

- Assumptions:
- Deviations:

## Batched Questions

-
