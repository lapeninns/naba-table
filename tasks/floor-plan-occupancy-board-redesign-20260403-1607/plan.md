---
task: floor-plan-occupancy-board-redesign
timestamp_utc: 2026-04-03T16:07:37Z
owner: github:@OpenAI
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Occupancy Board Redesign

## Objective

We will rebuild the Occupancy board into a clearer operations workspace so hosts can read live table pressure, inspect the floor, and adjust time or view without fighting a card-heavy layout.

## Success Criteria

- [ ] The board presents a stronger primary workspace with the map as the dominant visual anchor.
- [ ] Visible occupancy logic is summarized into operator-friendly signals while preserving the detailed status legend.
- [ ] Keyboard pan, zoom, reset, and timeline controls remain functional and tested.
- [ ] The redesign passes focused tests, lint, typecheck, and browser verification on the authenticated floor-plan route.

## Architecture & Components

- `FloorCanvas`: own the new board composition, higher-order occupancy metrics, overlay controls, and legend layout.
- `TimeScrubber`: become a docked dark utility control that feels native to the board rather than a nested card.
- `FloorPlanTable`: remain the canonical table target and preserve current hit-target logic.
  State: derived view state remains local to the board surface. No URL-state or backend contract changes.

## Data Flow & API Contracts

- No API or schema changes.
- `FloorCanvas` continues to consume `tables`, `time`, `bars`, pan/zoom state, and callbacks from the existing page/hook flow.
- Occupancy insights are derived from `getVisibleStatusBuckets(tables)` and `getStatusMeta(status)` only.

## UI/UX States

- Loading: unchanged at the page level.
- Success: dominant floor stage, service signal masthead, compact controls, status rail, and timeline dock.
- Empty search: centered overlay inside the map plane with the active query.
- Error: unchanged and handled above the board.

## Edge Cases

- Zero visible tables should not create divide-by-zero occupancy metrics.
- Dense status sets still need readable contrast on the darker stage.
- The control rail must not block pointer or keyboard map navigation.

## Testing Strategy

- Unit/component: update `tests/components/floor-plan/FloorCanvas.test.tsx` for the new semantics while preserving navigation and timeline assertions.
- Regression: keep `FloorPlanTable` hit-target proof intact.
- Manual verification: authenticated `http://app.localhost:3000/floor-plan` via Chrome DevTools with desktop and mobile spot checks.

## Rollout

- No feature flag; redesign lands directly on the canonical floor-plan route.
- Monitoring: browser proof plus scoped automated validation.
- Kill-switch: revert the floor-plan component changes if severe UX regression is discovered.

## DB Change Plan (if applicable)

- Not applicable. No database changes.
