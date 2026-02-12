---
task: refactor-floor-plan
timestamp_utc: 2026-02-12T14:55:12Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Floor Plan Refactor (Modularization, SOLID, Perf, A11y)

## Requirements

- Functional:
  - Preserve existing UI behavior for `/app/floor-plan` (tables render, selection works, inspector works, pan/zoom works, time scrubber works).
  - Keep timeline drag not panning canvas (recent bug fix must remain).
  - Search input must be functional (filter tables by table number / party name at minimum).
- Non-functional:
  - Maintainability: bring `FloorPlanPage` implementation in-line with repo guidance (<=500 LOC target, <=750 hard cap).
  - Performance: remove O(n^2) lookups in render-path computations; reduce pointer-move re-render churn.
  - Accessibility: ensure timeline slider has visible focus and remains keyboard-operable.

## Existing State (Key Findings)

- `src/components/features/seating/FloorPlanPage.tsx` is ~1231 LOC and mixes:
  - Data loading (react-query + services)
  - Domain transforms (operating hours -> timeline window; table layout normalization; segment -> status)
  - Interaction state machines (pan/zoom drag)
  - All UI components (tables, inspector, timeline scrubber)
- Performance hotspot:
  - For each table, code scans `timelineData.tables.find(...)` to find segments (O(n^2) worst-case).
- Correctness risk:
  - Date parsing inconsistently uses `new Date(selectedDate)` vs `new Date(selectedDate + 'T00:00:00')` which can shift day-of-week in some timezones.
- A11y gap:
  - Slider input is `opacity-0` with no visible focus affordance.
- Duplication:
  - `useMediaQuery` exists in multiple components with differing browser-compat behavior.

## Constraints & Risks

- Must not introduce new custom UI primitives (use existing Shadcn primitives).
- No new external deps unless clearly justified; prefer `date-fns` already present.
- Avoid cross-cutting refactors unrelated to floor plan unless directly required (e.g., shared `useMediaQuery` hook).

## Recommended Direction

- Extract coherent modules under `src/components/features/seating/floor-plan/*`:
  - UI components: table node, inspector, time scrubber, canvas container
  - Hooks: `useFloorPlanTimelineConfig`, `useFloorPlanTablesWithStatus`, `usePanZoom`
  - Pure helpers: date parsing, status mapping, fallback segment creation
- Replace linear search with `Map` lookups in status merge.
- Add `focus-within` visual ring for the scrubber to make keyboard focus obvious.
- Consolidate `useMediaQuery` into `src/hooks/useMediaQuery.ts` and update callsites.
