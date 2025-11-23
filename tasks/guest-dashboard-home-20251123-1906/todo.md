---
task: guest-dashboard-home
timestamp_utc: 2025-11-23T19:06:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Add `/dashboard` route with GuestLayout + auth guard (redirect when unauthenticated).
- [x] Wire React Query hydration for client dashboard.

## Core

- [x] Build `GuestDashboardClient` with hero/active booking/favorites/discovery/perks modules.
- [x] Add derived booking utilities (active/live/favorites).
- [x] Implement CTAs (modify/cancel/share/directions/running-late) linking to booking detail where possible.

## UI/UX

- [x] Update header nav/CTA to include dashboard.
- [x] Add mobile bottom tab bar per IA.
- [x] Responsive layout + visual polish (cards, rails, gradients) with accessible focus/labels.

## Docs

- [x] Align `guest-facing-routes.md` to new `/dashboard` home and redirect changes.

## Tests / QA

- [ ] Smoke `/dashboard` logged in/out.
- [ ] Accessibility + keyboard + responsive checks in Chrome DevTools (MCP).
- [ ] Run lint/typechecks if time permits.

## Notes

- Assumptions: discovery feed uses curated placeholders; running-late is a CTA to booking detail until backend support exists.
- Deviations: None yet.
