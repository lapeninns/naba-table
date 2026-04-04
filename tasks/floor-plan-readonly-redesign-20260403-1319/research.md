---
task: floor-plan-readonly-redesign
timestamp_utc: 2026-04-03T14:00:45Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Floor Plan Read-Only Redesign

## Requirements

- Functional:
  - Keep the canonical floor-plan implementation in `src/components/features/seating/FloorPlanPage.tsx` and preserve the existing `/floor-plan` route plus redirects from `/app/seating` and `/app/seating/floor-plan`.
  - Remove booking creation, assignment, and booking-navigation controls from the shell and selected-table details.
  - Preserve zone, date, search, and time controls as in-place viewer filters.
  - Preserve keyboard pan/zoom/reset, pointer pan rules, empty-search recovery, and selection semantics.
  - Keep desktop and mobile details content-equivalent and read-only.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Manual Chrome DevTools verification is required on the authenticated route unless auth/bootstrap is blocked.
  - No API, database, migration, or schema changes are allowed.
  - Status presentation must remain centralized through `src/components/features/seating/floor-plan/lib/status.ts`.

## Existing Patterns & Reuse

- `src/components/features/seating/FloorPlanPage.tsx` already owns local floor-plan state, toolbar filters, selection, and responsive detail containers.
- `src/components/features/seating/floor-plan/hooks/useFloorPlanTables.ts` is the single place mapping table inventory plus timeline data into display statuses and table render data.
- `src/components/features/seating/floor-plan/components/FloorCanvas.tsx` already owns map interactions, keyboard pan/zoom/reset, and time scrubber composition.
- `src/components/features/seating/floor-plan/components/TableInspector.tsx` is already the shared desktop/mobile detail presenter, but it still renders mutation-era actions and copy.
- Existing dev harness path exists at `src/app/(public)/dev/ops-floor-plan/**` and should be reused only as a fallback validation surface.

## External Resources

- Mission contract: `/Users/amankumarshrestha/.factory/missions/34cdd665-d064-4743-8749-db6f01b14151/validation-contract.md` — source of truth for required UI assertions.
- Mission notes:
  - `contract-work/shell-filters-notes.md`
  - `contract-work/canvas-notes.md`
  - `contract-work/details-notes.md`
  - `contract-work/cross-flow-notes.md`

## Constraints & Risks

- `FloorPlanPage` currently imports `useRouter` and wires `New booking` / `Browse bookings` actions through both the header and the detail surface; removing these must not disturb existing filter or selection behavior.
- Selection currently derives from `filteredTables`, so hidden-by-filter behavior already closes details; this needs to be preserved while allowing non-hiding updates to refresh in place.
- The current mission metadata references a task folder that was missing in this worktree; this folder was created to match the factory metadata exactly.
- Repo-wide Vitest failures in unrelated email/auth suites are a known pre-existing issue and are out of scope for this mission.

## Open Questions (owner, due)

- None. The mission contract and feature breakdown provide the required behavior.

## Recommended Direction (with rationale)

- Keep the redesign on the canonical production path by:
  - refactoring `FloorPlanPage` into a map-first read-only shell with informational summary copy only,
  - turning `FloorCanvas` into an occupancy board with visible-status legend and counts derived from currently visible tables,
  - converting `TableInspector` into a passive presenter shared by desktop and mobile,
  - strengthening `useFloorPlanTables` and new floor-plan component tests to lock down status semantics and the absence of action controls.
- This preserves the existing data path and interaction model while making the read-only contract explicit and testable.
