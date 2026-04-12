---
task: guest-style-preset-migration
timestamp_utc: 2026-04-11T17:36:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Guest Style Preset Migration

## Objective

We will migrate the guest-facing UI to the shadcn preset `b1aKNEah8` so that the public and guest account surfaces adopt the new visual language without breaking route behavior or sending generated files into the wrong paths.

## Success Criteria

- [x] shadcn config points at the active `src/` CSS path used by the guest experience.
- [x] The preset migration is applied safely without overwriting shared non-guest primitives.
- [x] Core guest surfaces adopt the new style consistently.
- [x] Guest booking/account behaviors remain intact.

## Architecture & Components

- Config layer:
  - `components.json`
  - global CSS / tokens
- Guest shells:
  - `src/components/layouts/**`
  - `src/components/landing/**`
  - `src/components/shared/**`
- Route surfaces:
  - `src/app/(public)/**`
  - `src/app/guest/**`

## Data Flow & API Contracts

- No API contract changes intended.
- This should remain a presentation/system migration unless discovered otherwise.

## UI/UX States

- Loading / empty / error / success states must retain current meaning while visual treatment changes.

## Edge Cases

- Existing root-level `components/` and `lib/` directories mean shadcn CLI output pathing must be validated carefully.
- Guest and marketing surfaces share some layout primitives; migration should update canonical shared shells rather than duplicating style logic.
- The requested `--monorepo` reinstall path is not compatible with this repo because there is no `packages/ui/components.json`.

## Testing Strategy

- Targeted unit/type/lint checks for touched files.
- Chrome DevTools MCP verification across key guest pages.
- If route shells change materially, add or update focused tests around shared layout output.

## Rollout

- No feature flag by default.
- Migrate guest-facing pages in canonical codepaths and verify locally before considering broader adoption.
- Keep ops-facing and other non-guest surfaces on their current styling until a separate migration is requested.

## DB Change Plan (if applicable)

- Not applicable.
