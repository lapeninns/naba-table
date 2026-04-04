---
task: floor-plan-readonly-redesign
timestamp_utc: 2026-04-03T13:19:25Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Review root and closest AGENTS guidance for `src/components/**` and `src/app/**`.
- [x] Inspect the canonical floor-plan route, component stack, and supporting hooks/helpers.
- [ ] Confirm validation readiness for the authenticated floor-plan route or harness fallback.

## Core

- [ ] Remove booking/navigation actions from `FloorPlanPage` and keep selection state local-only.
- [ ] Rework the layout into a lighter header, hero canvas, and read-only details surfaces.
- [ ] Convert `TableInspector` into a passive read-only presenter.
- [ ] Consolidate status presentation through existing floor-plan status helpers.

## UI/UX

- [ ] Keep zone/date/search/time controls and timeline behavior intact.
- [ ] Preserve keyboard pan/zoom, empty-search handling, and predictable selection clearing.
- [ ] Verify desktop panel and mobile bottom sheet behavior for selected tables.

## Tests

- [ ] Update/add focused component tests for the read-only floor-plan contract.
- [ ] Extend `useFloorPlanTables` coverage for occupancy status derivation.
- [ ] Run validators.
- [ ] Complete Chrome DevTools manual verification for desktop and mobile.

## Notes

- Assumptions:
  - Read-only means no booking creation, assignment, or booking-navigation actions from this screen.
  - Existing data-fetching and timeline semantics remain unchanged.

- Deviations:
  - None yet.

## Batched Questions

- None.
