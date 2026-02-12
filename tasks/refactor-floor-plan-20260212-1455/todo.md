---
task: refactor-floor-plan
timestamp_utc: 2026-02-12T14:55:12Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Phase 0/1/2

- [x] Create task folder + research + plan.

## Refactor

- [x] Create `src/hooks/useMediaQuery.ts`; update callsites.
- [x] Extract floor plan submodules under `src/components/features/seating/floor-plan/`.
- [x] Reduce `FloorPlanPage.tsx` to orchestration only (<=500 LOC).

## Perf/Correctness/A11y

- [x] Replace timeline `.find()` per table with `Map` lookup.
- [x] Normalize date parsing to local date-only helper.
- [x] Add visible focus affordance for slider (focus-within ring).
- [x] rAF-batch pan updates during drag.

## Feature Completion

- [x] Implement search filtering (table number / party name / zone).

## Verification

- [x] `npm run typecheck`
- [x] `npm run lint` (no new warnings)
- [x] Chrome DevTools MCP QA + artifacts
- [x] Complete `verification.md`
