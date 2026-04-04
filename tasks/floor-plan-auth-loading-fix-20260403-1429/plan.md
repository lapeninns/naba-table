---
task: floor-plan-auth-loading-fix
timestamp_utc: 2026-04-03T14:29:24Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Floor Plan Auth Reload Stability

## Objective

We will stabilize the authenticated `/floor-plan` route after hard reloads so that operations users land on the real read-only occupancy view consistently instead of getting stuck on the loading shell.

## Success Criteria

- [x] Hard reloads on `http://app.localhost:3000/floor-plan` render the occupancy board instead of remaining on `Loading floor plan…`.
- [x] The canonical floor-plan route still supports the read-only map, details panel/sheet, filters, and time controls.
- [x] The floor-plan-specific Lighthouse issue is reduced so the remaining audit failure is outside the floor-plan surface.

## Architecture & Components

- `src/app/providers.tsx`: adjust query persistence bootstrap so auth hydration does not wipe active queries during the anonymous -> authenticated transition.
- `src/components/features/seating/floor-plan/components/FloorPlanTable.tsx`: tighten hit-target geometry for dense floor-plan clusters without changing the visible table presentation.
- `tests/components/floor-plan/FloorPlanTable.test.tsx`: prove the hit-target geometry on the production component path.

## Data Flow & API Contracts

- No API contract changes.
- Existing calls to:
- `GET /api/ops/restaurants/:id`
- `GET /api/ops/restaurants/:id/hours`
- `GET /api/ops/restaurants/:id/service-periods`
- `GET /api/ops/zones`
- `GET /api/ops/tables?includeSummary=0`
- `GET /api/ops/tables/timeline?...&includeSummary=0`
- remain unchanged.

## UI/UX States

- Loading: authenticated route may briefly bootstrap, but should settle into the occupancy board.
- Success: occupancy board, details panel/sheet, and read-only table inspection render normally.
- Residual issue: sidebar label contrast remains slightly under Lighthouse threshold and is outside the floor-plan component tree.

## Edge Cases

- Reload while auth status is still hydrating from Supabase.
- Transition from anonymous/local boot state to authenticated per-user query persistence.
- Dense table clusters on the map at the default zoom level.

## Testing Strategy

- Focused Vitest suite on floor-plan components and hook semantics.
- Scoped ESLint and `pnpm typecheck`.
- Chrome DevTools verification on the authenticated route with hard reloads and Lighthouse snapshot.

## Rollout

- No feature flag change.
- Dev verification only for this pass; no production config changes.
