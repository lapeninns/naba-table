---
task: floor-plan-reference
timestamp_utc: 2026-01-02T20:25:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Floor Plan Reference Refresh

## Requirements

- Functional: replace the `/floor-plan` UI with the provided reference layout, supporting pan, zoom, and table selection.
- Non-functional: responsive layout, accessible interactions, no console errors, and reuse existing data sources.

## Existing Patterns & Reuse

- `src/components/features/seating/FloorPlanPage.tsx` provides data fetching, timeline, and table status logic.
- `src/components/features/dashboard/TableFloorPlan.tsx` shows table rendering patterns and status handling.
- Ops styling and tokens live in `src/app/globals.css` and `styles/tokens.css`.

## External Resources

- Reference floor-plan snippet supplied by the user (chat attachment).

## Constraints & Risks

- UI change only; keep existing data flow and route wiring.
- Must map current status states to reference visual states without backend changes.

## Open Questions (owner, due)

- Q: Should the new layout fully replace `FloorPlanPage` or be introduced as an alternate view? (owner: github:@amanshresthaa)

## Recommended Direction (with rationale)

- Re-skin `FloorPlanPage` to match the reference layout while preserving data queries and timeline logic to avoid regressions.
