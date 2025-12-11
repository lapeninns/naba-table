---
task: guest-spacing-consistency
timestamp_utc: 2025-12-11T08:32:00Z
owner: github:@assistant
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Capture guest spacing requirements and design-token references.
- [x] Add `.guest-boundary` utility for reusable safe-area-aware gutters.

## Core

- [x] Refactor `GuestLayout` and `AuthLayout` to use the shared boundary wrapper.
- [x] Align `GuestNavbar` and `AuthNavbar` containers with the same gutters.
- [x] Update Factory landing sections (`FactoryHomeClient`) to consume `guest-boundary` + tightened section spacing.
- [x] Update shared `Footer` + Factory landing footer to avoid ad-hoc `px-*` padding.

## UI/UX

- [ ] Run Chrome DevTools MCP manual QA on `/`, `/auth/signin`, `/guest/dashboard` (mobile + desktop) and capture artifacts.

## Tests

- [x] `pnpm run lint`
- [x] `pnpm run test -- tests/server/homepage-redirect.test.tsx` (fails in existing `/api/bookings GET` suite; see verification)

## Notes

- Safe-area padding via `env()` now ensures navbars hug notched devices without extra wrappers.
