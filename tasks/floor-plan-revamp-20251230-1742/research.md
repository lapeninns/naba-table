---
task: floor-plan-revamp
timestamp_utc: 2025-12-30T17:42:41Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Floor Plan Revamp

## Requirements

- Functional:
  - Revamp `/floor-plan` UX/UI and its components from scratch while preserving core behaviors.
  - Support key tasks: add booking, browse bookings, and table status at selected time.
  - Keep major capabilities unless removal is clearly justified (zoom/pan, zone filtering, date/time selection, table inspector, walk-in launch).
  - Ensure cross-device support (small → large screens).
- Non-functional (a11y, perf, security, privacy, i18n):
  - Maintain WCAG/WAI-ARIA compliance, keyboard navigation, and visible focus.
  - Use Shadcn UI as base to align with existing pages and tokens.
  - Meet perf budgets in AGENTS (FCP ≤2s, LCP ≤2.5s, CLS ≤0.10, TBT ≤200ms).
  - No secrets in source; no new PII exposure.

## Existing Patterns & Reuse

- Floor plan route: `src/app/app/(app)/floor-plan/page.tsx` uses `FloorPlanPage`.
- Ops bookings list route: `src/app/app/(app)/bookings/page.tsx` renders `OpsBookingsClient`.
- New bookings route: `src/app/app/(app)/new-bookings/page.tsx` renders `WalkInWizardClient`.
- Primary UI: `src/components/features/seating/FloorPlanPage.tsx` (zoom/pan canvas, time scrubber, zone filter, inspector panel).
- Table status & layout patterns: `src/components/features/dashboard/TableFloorPlan.tsx` (floor plan mini view).
- Ops shell layout and tokens: `src/components/features/ops-shell/OpsSidebarLayout.tsx`, `styles/tokens.css`, `src/app/globals.css`.
- Shadcn base patterns in ops pages: `src/components/features/tables/TableInventoryClient.tsx`, `src/components/ui/*`.

## External Resources

- N/A (Shadcn UI library and existing repo patterns are the baseline).

## Constraints & Risks

- Must follow SDLC phases; no implementation before plan approval.
- UI changes require Chrome DevTools MCP QA with artifacts.
- Avoid over-engineering; keep changes scoped to `/floor-plan`.
- Risk: Revamp may inadvertently change workflows; validate “add booking” and “browse bookings” semantics.
- API/contract changes are allowed if justified by the new UX.

## Open Questions (owner, due)

- Any required visual tokens (fonts/colors) or should we adopt existing app tokens strictly? (owner: github:@maintainers, due: 2025-12-30)
- Default “nearby” booking window: ±90 minutes (AI decision; okayed by user).

## Recommended Direction (with rationale)

- Rebuild layout with Shadcn primitives (Card, Tabs, Tooltip, Dropdown, Sheet) for consistency and maintainability.
- Preserve existing data/services and interactions unless explicitly changed.
- Route “add booking” actions to `/new-bookings` with date/time/table context.
- Route “browse bookings” to `/bookings` with contextual filters (date + table/time).
- Define a clear header + toolbar, floor canvas, and inspector panel that scale responsively across devices.
