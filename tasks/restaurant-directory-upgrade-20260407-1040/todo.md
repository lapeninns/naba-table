---
task: restaurant-directory-upgrade
timestamp_utc: 2026-04-07T10:40:47Z
owner: github:@amankumarshresthaa
reviewers: [github:@amankumarshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review route/component AGENTS rules for `src/app/**` and `src/components/**`
- [x] Inspect current public restaurant list and detail implementation
- [x] Define the directory metadata approach in task artifacts

## Core

- [x] Add a typed directory metadata layer with curated overrides and sensible fallbacks
- [x] Enrich the restaurant list route with directory-aware data
- [x] Upgrade the restaurant detail route with richer descriptive content and venue categories
- [x] Keep booking/contact/map actions wired to canonical operational fields

## UI/UX

- [x] Add search/filter controls that help diners browse by category and descriptive cues
- [x] Improve listing cards so they explain why a venue is worth opening
- [x] Improve the detail page so it feels like a useful directory entry, not only a booking wrapper
- [x] Keep accessibility and responsive behavior intact

## Tests

- [x] Update or add focused tests for the public directory routes
- [x] Run targeted Vitest coverage
- [x] Run `pnpm typecheck`

## Notes

- Assumptions:
  - Curated metadata will begin with priority venues and generic fallbacks will cover the rest of the directory cleanly.
- Deviations:
  - Browser verification used a dev-only harness route because `pnpm dev` in this worktree fails env validation before the public routes can boot.

## Batched Questions

- None at the moment.
