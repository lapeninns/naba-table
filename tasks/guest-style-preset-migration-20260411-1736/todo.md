---
task: guest-style-preset-migration
timestamp_utc: 2026-04-11T17:36:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Confirm migration mode: reinstall / merge / config-only
- [x] Align shadcn config to active `src/` paths if needed

## Core

- [x] Apply preset `b1aKNEah8` safely
- [x] Migrate guest-facing shells/components to the new style
- [x] Keep guest routes on canonical codepaths

## UI/UX

- [x] Public marketing pages
- [x] Guest account pages
- [x] Footer/nav/layout consistency

## Tests

- [x] Targeted automated verification
- [x] Chrome DevTools manual QA

## Notes

- Assumptions:
- "Guest-facing only" includes public marketing, public booking/discovery, and guest account shells, but excludes ops-facing UI.
- Deviations:
- The requested `pnpm dlx shadcn@latest init --preset b1aKNEah8 --template next --monorepo` flow could not be applied directly because the repo is not laid out as a shadcn monorepo (`packages/ui/components.json` is missing).
- The preset was inspected in a scratch workspace and its visual language was ported into guest-facing wrappers/components instead of reinstalling shared source.

## Batched Questions

- None.
