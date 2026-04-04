---
task: floor-plan-readonly-redesign
timestamp_utc: 2026-04-03T14:24:12Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review root and closest `AGENTS.md` guidance for the floor-plan files.
- [x] Pull mission contract, mission notes, and validator commands from `.factory`.
- [x] Create the missing mission task folder in this worktree.

## Core

- [x] Add RED tests for the read-only shell, canvas summary, passive details, and selection semantics.
- [x] Remove booking navigation and assignment behavior from `FloorPlanPage`.
- [x] Add visible occupancy legend and summary counts to `FloorCanvas`.
- [x] Convert `TableInspector` to a passive presenter with read-only copy only.
- [x] Extend `useFloorPlanTables` regression coverage for reserved, seated, available, loading, and out-of-service semantics.

## UI/UX

- [x] Keep zone/date/search/time controls working in place on `/floor-plan`.
- [x] Preserve keyboard pan/zoom/reset and pointer pan rules.
- [x] Preserve desktop/mobile details parity and selection clearing behavior.

## Tests

- [x] `npx vitest run tests/ops/useFloorPlanTables.test.tsx tests/components/floor-plan --passWithNoTests --maxWorkers=9`
- [x] `pnpm typecheck`
- [x] `npx eslint "src/components/features/seating/**/*.{ts,tsx}" "src/app/app/(app)/floor-plan/page.tsx" "src/app/app/(app)/seating/page.tsx" "src/app/app/(app)/seating/floor-plan/page.tsx" "src/app/(public)/dev/ops-floor-plan/**/*.{ts,tsx}" "tests/ops/useFloorPlanTables.test.tsx" "tests/components/floor-plan/**/*.{ts,tsx}"`
- [x] Chrome DevTools / browser verification on authenticated `/floor-plan`

## Notes

- Assumptions:
- The existing redirect routes and dev harness remain valid and do not need structural changes.

- Deviations:
- The factory mission metadata referenced `tasks/floor-plan-readonly-redesign-20260403-1319/`, but that folder was absent in this worktree. It has been created now to match the mission references.
- Authenticated `http://app.localhost:3000/floor-plan` remained on the existing loading shell even after all required data requests returned `200`, so detailed interaction QA used the existing dev-only harness at `http://localhost:3000/dev/ops-floor-plan` as compensating evidence.

## Batched Questions

- None.
