---
task: dashboard-maintainability-refactor
timestamp_utc: 2026-03-19T11:03:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Dashboard maintainability refactor

## Requirements

- Functional:
  - Preserve current ops dashboard behavior while improving internal maintainability.
  - Keep query params, date navigation, dialogs, mutations, and realtime interactions working as they do today.
- Non-functional (a11y, perf, security, privacy, i18n):
  - No UI or accessibility regressions.
  - No additional network requests or expanded auth surface.
  - Refactor should reduce cognitive load and localize logic ownership.

## Existing Patterns & Reuse

- `src/components/features/dashboard/useOpsDashboardState.ts` currently combines query state, dialog state, derived view state, and action orchestration.
- `src/components/features/dashboard/bookingFilters.ts` is a good local example of centralized dashboard business rules.
- `src/hooks/ops/useOpsTodaySummary.ts` already separates data fetching from the page shell and can remain the data-source boundary.

## Constraints & Risks

- `useOpsDashboardState` is consumed by `OpsDashboardClient`, so the returned API should remain stable unless all consumers are updated together.
- Date/query-state behavior is subtle because it reconciles URL params, placeholder summaries, and selected/requested date state.
- Mutation handlers currently mix optimistic snapshots and dialog coordination, so extraction must preserve ordering.

## Open Questions (owner, due)

- Q: How much of the current hook should be split in one pass?
  A: Limit this pass to internal concern boundaries that preserve the external return shape.

## Recommended Direction (with rationale)

- Extract focused helpers/hooks for:
  - dashboard query/date/search/sort URL state
  - dashboard dialog state
  - dashboard booking action orchestration
- Keep `useOpsDashboardState` as the composition layer so behavior stays stable while responsibilities become clearer.
