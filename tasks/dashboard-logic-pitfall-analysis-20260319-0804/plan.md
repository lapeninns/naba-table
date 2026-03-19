---
task: dashboard-logic-pitfall-analysis
timestamp_utc: 2026-03-19T08:04:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Dashboard logic pitfall analysis

## Objective

We will identify the root-cause logic pitfall on the ops dashboard so that we can make a precise fix without destabilizing dashboard data, filters, or booking actions.

## Success Criteria

- [x] Dashboard route composition, client state ownership, and query dependencies are mapped.
- [x] The likely or confirmed pitfall is described with code references and impact.
- [x] A recommended fix path and verification approach are documented.

## Architecture & Components

- `src/app/app/(app)/dashboard/page.tsx`: server entrypoint, membership lookup, summary prefetch, hydration.
- `src/components/features/dashboard/OpsDashboardClient.tsx`: feature orchestration and UI state composition.
- `src/components/features/dashboard/useOpsDashboardState.ts`: core dashboard state, derived filters, URL sync, and action handlers.
- `src/hooks/ops/*`: query/mutation hooks for summary, heatmap, assignments, updates.

## Data Flow & API Contracts

- Server prefetch: `GET /api/ops/dashboard/summary?restaurantId=<id>&date=<YYYY-MM-DD>`
- Client data refresh: summary, heatmap, and related dashboard queries keyed by restaurant and date.
- Mutations: booking update/cancel/status actions invalidate dashboard query caches.

## UI/UX States

- Loading / empty / error / success
- Date navigation, restaurant switching, filters, print flow, and booking dialogs

## Edge Cases

- Missing or delayed membership resolution
- Invalid date query params
- Mismatch between URL state and local filter state
- Partial query invalidation causing stale summary vs list/heatmap data

## Testing Strategy

- Static codepath analysis
- Local runtime/API inspection where feasible
- Targeted tests only if a fix is implemented

## Rollout

- No rollout change for analysis-only work.

## DB Change Plan (if applicable)

- None expected.
