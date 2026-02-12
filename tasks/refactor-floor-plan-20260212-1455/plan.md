---
task: refactor-floor-plan
timestamp_utc: 2026-02-12T14:55:12Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Floor Plan Refactor (Modularization, SOLID, Perf, A11y)

## Objective

Refactor `/app/floor-plan` into smaller, testable modules with clear responsibilities while preserving behavior and improving performance and accessibility.

## Success Criteria

- [ ] `src/components/features/seating/FloorPlanPage.tsx` <= 750 LOC (target <= 500).
- [ ] No behavior regressions: pan/zoom, table selection, inspector, time scrubber.
- [ ] Search input filters visible tables (table number / party name).
- [ ] Remove O(n^2) timeline lookup: use `Map`-based lookups.
- [ ] Slider focus is visible (keyboard users can see where they are).

## Architecture & Components

Keep `FloorPlanPage` as the orchestrator and extract into:

- `src/components/features/seating/floor-plan/components/`
  - `FloorCanvas.tsx` (canvas container, overlays, renders tables)
  - `FloorPlanTable.tsx` (table button node)
  - `TimeScrubber.tsx` (timeline UI)
  - `TableInspector.tsx` (inspector component)
- `src/components/features/seating/floor-plan/hooks/`
  - `useFloorPlanTimelineConfig.ts` (operating hours + slots -> timeline config)
  - `useFloorPlanTables.ts` (tables + timeline -> display tables)
  - `usePanZoom.ts` (pan/zoom state machine, rAF batching)
- `src/components/features/seating/floor-plan/lib/`
  - `date.ts` (local date parsing helper)
  - `status.ts` (segment -> status mapping + color tokens)
  - `timeline.ts` (fallback segment + segment-at-time helper)
  - `types.ts` (local UI types)

Shared hook:

- `src/hooks/useMediaQuery.ts` (canonical hook, used by floor plan and ops booking card)

## Key Implementation Notes

- Keep all business/status rules in one place (`status.ts`).
- Avoid expensive recomputations:
  - precompute `Map<tableId, segments>` for quick status resolution.
  - split layout normalization from time-based status resolution.
- Pointer move performance:
  - batch pan updates via `requestAnimationFrame` to avoid 60+ React state updates per second.

## Testing Strategy

- Typecheck: `npm run typecheck`
- Lint: `npm run lint` (expect existing warnings only, no new warnings introduced)
- Manual QA (Chrome DevTools MCP):
  - use `http://localhost:3000/dev/ops-floor-plan` harness (auth-free)
  - validate: background pan, zoom, table click selection, slider drag not panning, slider focus ring visible, search filters tables.

## Rollout

- No feature flag (refactor-only change, same route).
- If regressions found, revert plan is straightforward (single component/hook boundaries; no schema changes).
