---
task: ops-dashboard-revamp
timestamp_utc: 2026-02-05T09:06:06Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Dashboard Revamp

## Objective

We will reduce operator cognitive load by removing the overview panel entirely and keeping the dashboard focused on bookings.

## Success Criteria

- [ ] Bookings list is primary with filters/search inline above it.
- [ ] Overview panel is removed; no heatmap.
- [ ] Visual stress is reduced (lighter filters, calmer cards).

## Architecture & Components

- `OpsDashboardClient` removes top-level toolbar.
- `OpsDashboardSummarySection` renders bookings panel only.
- `DashboardSummaryCard` becomes bookings-only.

## Data Flow & API Contracts

- No backend or API changes.

## UI/UX States

- Bookings panel: filters, search, sort, list.

## Edge Cases

- Mobile view stacks bookings before overview.
- Empty bookings still show calm empty state.

## Testing Strategy

- Manual QA for layout and interaction states.
- Lint + typecheck.

## Rollout

- No flag; ship directly.

## DB Change Plan (if applicable)

- Not applicable.
