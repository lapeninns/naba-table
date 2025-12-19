---
task: guest-dashboard-revamp
timestamp_utc: 2025-12-09T17:36:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm DesignSystem token usage patterns (heading/text/shadow-card) applied in dashboard file.
- [ ] Note assumptions/open questions in code comments or task folder.

## Core

- [x] Recompose dashboard shell spacing using design-system utilities and `GuestSection`.
- [x] Add highlights row (bookings count, upcoming, favorites) using badges/tokens.
- [x] Restyle featured booking / empty hero with design-system surfaces and CTAs.
- [x] Align quick action tiles to pill/card style with consistent icon sizes and focus states.
- [x] Refresh upcoming bookings list styling (text hierarchy, focusable link) with skeleton alignment.
- [x] Refresh favorites list styling and CTA; keep empty/skeleton states consistent.
- [x] Keep share/directions/QR interactions intact and accessible.

## Tests / QA

- [ ] pnpm lint (or scoped equivalent) if time permits.
- [ ] Manual QA via Chrome DevTools MCP: keyboard nav, responsive checks, Lighthouse/a11y for `/guest/dashboard`; save artifacts.
- [ ] Update `verification.md` with outcomes and attach artifacts.

## Notes

- Assumptions: quick actions + QR dialog stay; focus on visual revamp using tokens.
- Deviations: n/a yet.

## Batched Questions

- Should we surface more than 3 favorites/upcoming? (default: top 3 + link CTA)
