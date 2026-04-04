---
task: floor-plan-readonly-redesign
timestamp_utc: 2026-04-03T14:00:45Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Floor Plan Read-Only Redesign

## Objective

We will turn `/floor-plan` into a calm, read-only occupancy viewer so ops users can inspect live table state without being prompted into booking workflows.

## Success Criteria

- [ ] The header and shell show informational copy only, with no booking creation, assignment, or booking-navigation controls.
- [ ] The canvas shows visible-status legend and summary counts for available, reserved, seated, loading, and out-of-service tables.
- [ ] Desktop and mobile details surfaces render the same read-only facts and no action controls.
- [ ] Selection, filtering, timeline scrubbing, and pan/zoom semantics remain intact.
- [ ] Focused tests, lint, typecheck, and browser verification all pass on the canonical floor-plan path.

## Architecture & Components

- `src/components/features/seating/FloorPlanPage.tsx`
  - keep as orchestration-only shell for local state, filters, selection, and responsive layout
  - remove `useRouter`, booking-launch state, and action-era copy
- `src/components/features/seating/floor-plan/components/FloorCanvas.tsx`
  - add occupancy-board summary and legend using visible table data only
  - keep existing pan/zoom/time-scrubber interaction surfaces
- `src/components/features/seating/floor-plan/components/TableInspector.tsx`
  - render passive status, capacity, zone, seating type, current party, and timing content
  - expose a close action only
- `src/components/features/seating/floor-plan/hooks/useFloorPlanTables.ts`
  - keep status mapping as the single source of truth and expand regression coverage
- `src/components/features/seating/floor-plan/lib/status.ts`
  - keep status presentation centralized here; avoid component-level ad hoc color branching

## Data Flow & API Contracts

- No API changes.
- Existing table inventory query, zone query, timeline query, and timeline-config hooks remain unchanged.
- Visible occupancy summary derives from the already filtered tables passed into `FloorCanvas`.

## UI/UX States

- Idle desktop panel: passive guidance only.
- Selected details:
  - reserved / seated: read-only occupancy facts
  - available / loading / out-of-service: passive explanatory copy
- Empty search: keep the canvas visible with informational no-match messaging only.
- Mobile sheet remains the same selected-table surface as desktop, with read-only accessibility copy.

## Edge Cases

- Pointer-initiated canvas pan clears selection; keyboard panning does not.
- Selection persists through date/time/filter changes only while the selected table remains visible.
- Hiding a selected table via zone or search closes the details UI cleanly.
- Only one details container is visible after viewport changes between desktop and mobile.

## Testing Strategy

- RED-first component tests:
  - `tests/components/floor-plan/FloorPlanPage.test.tsx`
  - `tests/components/floor-plan/FloorCanvas.test.tsx`
  - `tests/components/floor-plan/TableInspector.test.tsx`
  - `tests/components/floor-plan/FloorPlanSelection.test.tsx`
- Extend `tests/ops/useFloorPlanTables.test.tsx` for status semantics and visible filtering expectations.
- Validators:
  - `npx vitest run tests/ops/useFloorPlanTables.test.tsx tests/components/floor-plan --passWithNoTests --maxWorkers=9`
  - `pnpm typecheck`
  - `npx eslint "src/components/features/seating/**/*.{ts,tsx}" "src/app/app/(app)/floor-plan/page.tsx" "src/app/app/(app)/seating/page.tsx" "src/app/app/(app)/seating/floor-plan/page.tsx" "src/app/(public)/dev/ops-floor-plan/**/*.{ts,tsx}" "tests/ops/useFloorPlanTables.test.tsx" "tests/components/floor-plan/**/*.{ts,tsx}"`

## Rollout

- No feature flag or staged rollout; this is a canonical UI redesign on the existing route.
- Manual validation surface:
  - primary: `http://app.localhost:3000/floor-plan`
  - fallback only if auth/bootstrap blocks: `http://localhost:3000/dev/ops-floor-plan`
