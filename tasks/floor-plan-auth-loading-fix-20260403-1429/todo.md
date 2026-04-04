---
task: floor-plan-auth-loading-fix
timestamp_utc: 2026-04-03T14:29:24Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create a new task folder for the authenticated floor-plan stability follow-up.
- [x] Re-read the relevant AGENTS guidance and Nabatable repo-local skills.
- [x] Reproduce or falsify the authenticated reload blocker on the canonical route.

## Core

- [x] Inspect the authenticated route, query persistence layer, and Supabase session hydration path.
- [x] Fix the query bootstrap race in `src/app/providers.tsx` so auth hydration does not clear live queries during reload.
- [x] Tighten floor-plan table hit-target geometry in `src/components/features/seating/floor-plan/components/FloorPlanTable.tsx`.
- [x] Add focused regression coverage for the new hit-target geometry.

## UI/UX

- [x] Re-verify the authenticated `/floor-plan` route after hard reloads.
- [x] Confirm the occupancy board still renders on the canonical route.
- [x] Confirm the remaining Lighthouse issue is outside the floor-plan component tree.

## Tests

- [x] `npx vitest run tests/ops/useFloorPlanTables.test.tsx tests/components/floor-plan --passWithNoTests --maxWorkers=9`
- [x] `npx eslint "src/components/features/seating/**/*.{ts,tsx}" "src/app/app/(app)/floor-plan/page.tsx" "src/app/app/(app)/seating/page.tsx" "src/app/app/(app)/seating/floor-plan/page.tsx" "src/app/(public)/dev/ops-floor-plan/**/*.{ts,tsx}" "src/app/providers.tsx" "tests/ops/useFloorPlanTables.test.tsx" "tests/components/floor-plan/**/*.{ts,tsx}"`
- [x] `pnpm typecheck`
- [x] Chrome DevTools verification on authenticated `/floor-plan`

## Notes

- Assumptions:
- The reload blocker was acceptable to fix at the shared query bootstrap layer because the floor-plan route exposed the bug reliably.

- Deviations:
- The originally suspected authenticated-route blocker was intermittent, not hard-broken. Investigation shifted from route wiring to query bootstrap once the route alternated between success and the loading shell across reloads.

## Batched Questions

- None.
