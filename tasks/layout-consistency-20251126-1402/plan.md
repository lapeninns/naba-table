---
task: layout-consistency
timestamp_utc: 2025-11-26T14:02:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Layout width consistency & Teams navigation

## Objective

Ensure settings-related pages use a consistent layout width and move the Teams entry into restaurant settings navigation without breaking routes.

## Success Criteria

- [ ] All settings pages/sections use a single agreed `max-w-*` container width.
- [ ] Teams nav item appears under restaurant settings and routes correctly.
- [ ] `pnpm run build` passes.

## Architecture & Components

- Identify layout containers in `src/app/app/(app)/settings` pages and their child components under `src/components/features/restaurant-settings/`.
- Adjust shared layout wrapper or per-section containers to a consistent width token.
- Update settings navigation source where Teams link is defined.

## Data Flow & API Contracts

- No API changes. Navigation routes must continue to match existing pages.

## UI/UX States

- Visual width alignment across settings sections; navigation grouping updated.

## Edge Cases

- Avoid shrinking layouts that would cause overflow of existing grids; verify responsive behavior at sm/md/lg.

## Testing Strategy

- Manual visual scan of settings pages (desktop); run `pnpm run build` for type safety.

## Rollout

- Immediate; no flags.

## DB Change Plan

- N/A
