---
task: delete-unused-homepage-code
timestamp_utc: 2026-04-13T18:48:00Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Delete Unused Homepage Code

## Objective

We will remove dead homepage implementations and supporting files so that the repo keeps a single canonical marketing homepage path and less maintenance overhead.

## Success Criteria

- [ ] The active `/` homepage still renders through `src/app/(public)/page.tsx` and `src/components/landing/LandingPage.tsx`.
- [ ] Confirmed-unreferenced homepage variants and their orphaned support files are deleted.
- [ ] The remaining landing barrels and imports no longer expose deleted components.
- [ ] Static validation passes for the touched areas.

## Architecture & Components

- Canonical path kept:
  - `src/app/(public)/page.tsx`
  - `src/components/landing/LandingPage.tsx`
  - `src/components/landing/sections/*`
  - active `src/components/landing/shared/*`, `seo/*`, and `optimizations/LazySection.tsx`
- Removal targets:
  - `src/components/landing/FactoryHomeClient.tsx`
  - `src/components/landing/HomeSections.tsx`
  - `src/components/landing/local-venues.json`
  - `src/data/homepage-content.json`
  - `components/owner-marketing/*`
  - `components/marketing/*`
  - dormant landing helpers tied only to comments or dead barrels

## Data Flow & API Contracts

- No API or data-contract changes.
- Static dependency graph only: remove unimported files and keep imports/barrels aligned with surviving code.

## UI/UX States

- No intended user-facing behavior change.
- Homepage should continue to show the same loading/rendering flow and auth redirect behavior as before.

## Edge Cases

- Shared landing helpers used by active sections must remain untouched.
- Historical docs may still reference deleted files; leave them unless they become broken build inputs.
- Barrel files should be pruned only if their deleted exports are no longer used.

## Testing Strategy

- Verification-first dependency scan to confirm orphan status before deletion.
- Static validation:
  - targeted ESLint on touched live files
  - `pnpm -s exec tsc --noEmit --pretty false`
- Browser proof:
  - Chrome DevTools MCP on `/` to confirm no console errors and unchanged homepage load

## Rollout

- No feature flag; dead-code cleanup on the canonical path.
- Kill-switch:
  - revert the cleanup commit if any hidden dynamic import or doc-time dependency surfaces.
