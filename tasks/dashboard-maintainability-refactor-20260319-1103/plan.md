---
task: dashboard-maintainability-refactor
timestamp_utc: 2026-03-19T11:03:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Dashboard maintainability refactor

## Objective

We will reduce the responsibility load inside the ops dashboard orchestration hook so that future dashboard changes are easier to reason about without changing user-visible behavior.

## Success Criteria

- [ ] `useOpsDashboardState` is smaller and more composition-oriented.
- [ ] Query/date URL state is isolated from dialog state and action orchestration.
- [ ] Repeated booking lifecycle handler patterns are centralized.
- [ ] The dashboard date model has a clearer boundary between URL-selected and active display dates.
- [ ] Focused dashboard tests still pass after the refactor.

## Architecture & Components

- `src/components/features/dashboard/useOpsDashboardState.ts`: retain as composition layer.
- `src/components/features/dashboard/*`: add focused local hooks/helpers for query state, dialogs, and booking actions.
- Existing query/mutation hooks remain the source of truth for network state.

## Data Flow & API Contracts

- Preserve `useOpsDashboardState`’s returned contract for `OpsDashboardClient`.
- Internal extracted hooks may receive narrow inputs and return state/action slices.

## UI/UX States

- No user-facing state changes intended.
- Loading / empty / error / success behavior should remain unchanged.

## Edge Cases

- Query-param sync when legacy `completed` filter is present.
- Date mismatch between placeholder summary and requested dashboard state.
- Dialog transitions between details, edit, and cancel flows.
- Pending lifecycle snapshots during async mutations.

## Testing Strategy

- Focused Vitest runs for dashboard utility and maintainability helpers.
- Add targeted tests for any extracted helper with non-trivial logic.

## Rollout

- No rollout change; internal refactor only.

## DB Change Plan (if applicable)

- None.
