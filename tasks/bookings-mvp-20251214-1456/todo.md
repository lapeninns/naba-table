---
task: bookings-mvp
timestamp_utc: 2025-12-14T14:56:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm effective AGENTS policy stack for touched files
- [x] Identify route/file owning `/bookings`
- [x] Ensure local dev doesn’t hit Watchpack EMFILE (polling/ignore)

## Core

- [x] Define MVP scope split: guest `/bookings` vs ops `/bookings` (host-based)
- [x] Fix guest `/bookings` entrypoint (implement page or change legacy redirects)
- [x] Fix ops auth redirect to preserve deep link (`/bookings?...restaurantId=...`)
- [x] Align ops bookings status types (UI filters vs API-supported values)
- [x] Remove/hide non-MVP UI elements (prefer delete over flags unless required)
- [x] Ensure restaurant scoping is enforced server-side (verify for mutations too)

## UI/UX

- [x] Loading / empty / error states
- [x] A11y: headings, labels, focus management
- [x] Mobile layout and readable density
- [x] Revamp mobile booking cards (dashboard components: Card/Badge/Separator)
- [x] Ops empty-state copy matches staff context (not diner copy)
- [x] Remove/hide list-only “extra” fields not backed by list API (loyalty/assignments/dietary)
- [x] Remove dead ops edit/cancel plumbing (list is Details-only)

## Tests

- [ ] Add/adjust tests for bookings page states (blocked: vitest setup missing in repo)
- [ ] Add/adjust E2E for core flow (out of scope for MVP pass)

## Verification

- [x] Chrome DevTools MCP: console/network clean
- [x] Chrome DevTools MCP: emulation (mobile/tablet/desktop)
- [ ] Chrome DevTools MCP: Lighthouse + a11y artifacts saved (not run in this pass)

## Notes

- Assumptions:
  - Ops bookings MVP prioritizes scan + Details; rich metadata lives in Details dialog.
- Deviations:
  - Continued without automated tests because `pnpm test` fails due to missing `tests/vitest.setup.ts` (repo-level).
