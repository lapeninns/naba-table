---
task: floor-plan-readonly-redesign
timestamp_utc: 2026-04-03T13:19:25Z
owner: github:@amanshresthaa
reviewers: [github:@amanshresthaa]
risk: medium
flags: []
related_tickets: []
---

# Research: Floor Plan Read-Only Redesign

## Requirements

- Functional:
  - Redesign `/floor-plan` into a strict read-only occupancy viewer.
  - Keep the canonical implementation in `src/components/features/seating/FloorPlanPage.tsx`.
  - Preserve current route structure, redirects, queries, filters, and timeline behavior.
  - Remove booking creation, assignment, and booking-navigation actions from the floor-plan surface.
  - Make table selection update local UI state only and present read-only table details.
- Non-functional (a11y, perf, security, privacy, i18n):
  - Preserve keyboard pan/zoom support and empty-search behavior.
  - Keep the experience responsive with a desktop details panel and mobile bottom sheet.
  - Centralize status styling through the existing floor-plan status helpers.
  - Verify the final UI on desktop and mobile with Chrome DevTools MCP against the authenticated route or a documented dev harness fallback.

## Existing Patterns & Reuse

- `FloorPlanPage` already owns filters, timeline state, selection state, and route-level composition.
- `FloorCanvas` already supports pan/zoom, keyboard controls, and table filtering feedback.
- `TableInspector` already renders selected-table details in desktop and mobile contexts.
- `useFloorPlanTables` is the existing status-derivation layer and should remain the source for table occupancy semantics.
- `src/components/features/seating/floor-plan/lib/status.ts` is the right place to keep status text/color/focus mapping centralized.

## External Resources

- None required; this is a UX refactor over existing floor-plan data and routes.

## Constraints & Risks

- Selection currently clears when the chosen table is filtered out or pan interactions begin; the redesign must preserve only the intended clearing behavior.
- The authenticated route may be blocked locally, so dev-harness verification may be required and must be documented if used.
- Status styling is partially scattered in the current feature, so refactoring must avoid changing reserved/seated/available/loading/closing semantics.

## Open Questions (owner, due)

- None at the moment. The user supplied a specific scope, layout direction, and validation expectations.

## Recommended Direction (with rationale)

- Keep the existing floor-plan data orchestration and route entrypoints intact while simplifying `FloorPlanPage` into a read-only composition layer.
- Reframe the layout around a lighter context header, a map-first canvas, and passive table details so the page becomes a scan-and-understand occupancy surface rather than an action launcher.
- Extend focused component tests plus `useFloorPlanTables` regression coverage so the redesign proves UI contract changes without altering occupancy semantics.
