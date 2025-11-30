---
task: sidebar-routes-fix
timestamp_utc: 2025-11-30T18:27:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Inspect ops navigation constants and current route structure.

## Core

- [x] Update sidebar nav `href` values to include `/app` prefix for all restaurant-facing routes.
- [x] Align any auth/sign-out redirects within ops shell to `/app` prefixed path if needed.
- [x] Verify active state matchers still reflect new paths.

## UI/UX

- [ ] Manual click-through of sidebar items in dev to confirm navigation works.

## Tests

- [ ] Run targeted manual QA (no automated tests needed for href update).

## Notes

- Assumptions: ops app is mounted at `/app`; public/guest routes remain unchanged.
- Deviations: None yet.

## Batched Questions

- None.
