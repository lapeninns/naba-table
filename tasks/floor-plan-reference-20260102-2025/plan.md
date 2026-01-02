---
task: floor-plan-reference
timestamp_utc: 2026-01-02T20:25:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Floor Plan Reference Refresh

## Objective

Rebuild the `/floor-plan` UI to match the provided reference design using Shadcn components as the base while keeping existing ops data and interactions intact.

## Success Criteria

- [ ] Floor plan renders the new layout on desktop and mobile with pan/zoom/select.
- [ ] Shadcn-based layout matches other ops pages (header, cards, controls).
- [ ] Table statuses are mapped and visible; inspector opens for selected tables.
- [ ] No console errors; lint/typecheck/tests pass.

## Architecture & Components

- `FloorPlanPage`: keep data fetching and state; replace UI layout and table renderer with Shadcn primitives.
- Inline subcomponents (TableSurface, TimeScrubber, Inspector) scoped to `FloorPlanPage` using `Card`, `Button`, `Badge`, `Input`.

## Data Flow & API Contracts

- No API changes. Continue using existing services/hooks (`useOpsTableTimeline`, table/zone services).

## UI/UX States

- Loading: keep existing loading/skeleton behavior for data fetches.
- Empty: handle no tables or missing positions gracefully.
- Error: preserve current toast/error behavior.

## Edge Cases

- Tables without positions: use existing fallback grid normalization.
- Timeline out of range: clamp to operating window.
- Small screens: inspector becomes overlay/sheet.

## Testing Strategy

- Run lint, typecheck, and tests per package.json.
- Manual UI QA via Chrome DevTools MCP (required).

## Rollout

- No feature flag; direct replacement of `/floor-plan` UI.

## DB Change Plan (if applicable)

- N/A
