---
task: floor-plan-readonly-redesign
timestamp_utc: 2026-04-03T13:19:25Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Floor Plan Read-Only Redesign

## Objective

We will redesign `/floor-plan` into a calm, map-first occupancy viewer so ops users can scan table state, filter by zone/date/search/time, and inspect read-only table details without leaving the page for booking actions.

## Success Criteria

- [ ] The floor-plan page shows no booking creation, assignment, or booking-navigation controls.
- [ ] The hero canvas remains the primary focus with pan/zoom, time scrubbing, legend, and occupancy summary intact.
- [ ] Selecting a table reveals read-only occupancy details on desktop and mobile.
- [ ] Zone/date/search/time controls continue to affect the visible canvas state correctly.
- [ ] Route redirects remain unchanged for `/app/seating` and `/app/seating/floor-plan`.
- [ ] Focused tests and Chrome DevTools UI verification pass for the redesigned experience.

## Architecture & Components

- `src/components/features/seating/FloorPlanPage.tsx`: orchestration-only page shell for header, filters, selection, canvas, and read-only inspector surfaces.
- `src/components/features/seating/floor-plan/components/FloorCanvas.tsx`: map-first occupancy board with legend, counts, pan/zoom controls, and time scrubber.
- `src/components/features/seating/floor-plan/components/TableInspector.tsx`: pure read-only presenter for selected-table metadata and status copy.
- `src/components/features/seating/floor-plan/lib/status.ts`: single source for semantic status presentation.

## Data Flow & API Contracts

- No API or database contract changes.
- Reuse the current zone, table inventory, restaurant profile, operating hours, service period, and timeline queries as-is.

## UI/UX States

- No restaurant selected
- Loading floor plan
- Search with no matching visible tables
- Selected table with read-only occupancy details
- Available / reserved / seated / loading / closing / out-of-service style presentation

## Edge Cases

- Search and zone changes should only clear selection when the selected table is no longer visible.
- Pan interactions may clear selection only where the current UX intentionally uses that behavior.
- Mobile sheet dismissal and reopening must stay predictable while removing action-state dependencies.
- Tables without saved coordinates still need sane fallback placement.

## Testing Strategy

- Extend `useFloorPlanTables` regression coverage for occupancy status derivation.
- Add focused component/page tests for CTA removal, read-only details rendering, and filter/timeline wiring.
- Run lint, typecheck, and targeted test commands for the affected floor-plan files.
- Complete Chrome DevTools verification on desktop and mobile against the authenticated route or a documented dev harness fallback.

## Rollout

- No feature flag or API rollout required; ship as a scoped UI refactor on the canonical floor-plan route.
