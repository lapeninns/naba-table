---
task: remove-floor-plan
timestamp_utc: 2026-04-03T16:41:00Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Remove Floor Plan

## Objective

We will remove the floor-plan feature from the ops product surface so users no longer see, navigate to, or run into the unsupported experience.

## Success Criteria

- [ ] The ops sidebar no longer shows a Floor Plan destination.
- [ ] `/floor-plan` and legacy seating aliases redirect to `/dashboard`.
- [ ] Floor-plan feature components, dev harnesses, and tests are removed from the codebase.
- [ ] Scoped validation passes and browser verification confirms the feature is no longer exposed.

## Architecture & Components

- `navigation.tsx`: remove the nav item and any now-unused icon imports.
- `src/app/app/(app)/floor-plan/page.tsx`: redirect to `/dashboard`.
- `src/app/app/(app)/seating/page.tsx` and `src/app/app/(app)/seating/floor-plan/page.tsx`: redirect to `/dashboard`.
- Delete `src/components/features/seating/FloorPlanPage.tsx` and `src/components/features/seating/floor-plan/**`.
- Delete dev harnesses and floor-plan-focused tests.

## Data Flow & API Contracts

- No API changes. Existing table/timeline endpoints remain untouched even though the UI consumer is removed.

## UI/UX States

- Floor-plan entry removed from navigation.
- Existing floor-plan deep links redirect to dashboard.

## Edge Cases

- Old bookmarks to floor-plan routes should land somewhere useful.
- Test and import graphs must remain clean after deleting the feature directory.

## Testing Strategy

- Run targeted search-backed validation on removed references.
- Run scoped lint and typecheck for touched app/components files.
- Browser-check that `/floor-plan` lands on dashboard and the sidebar no longer shows Floor Plan.

## Rollout

- No feature flag. Direct removal.
- Kill-switch: revert the removal if product decides to restore the feature later.

## DB Change Plan (if applicable)

- Not applicable. No database changes.
