---
task: ops-dashboard-refactor
timestamp_utc: 2026-03-29T07:12:00Z
owner: github:@maintainers
reviewers: [github:@maintainers]
risk: high
flags: []
related_tickets: []
---

# Research: Ops Dashboard Refactor

## Requirements

- Functional:
  - Preserve current dashboard route, query params, booking actions, and user-visible states.
  - Consolidate dashboard data and realtime ownership behind a single source of truth.
  - Remove duplicate Supabase browser clients.
- Non-functional:
  - Improve maintainability and reduce state duplication.
  - Maintain or improve current runtime performance and dashboard responsiveness.
  - Avoid accessibility regressions.

## Existing Patterns & Reuse

- Dashboard route and auth proxy exist in `src/proxy.ts`.
- Current server prefetch and hydration exist in `src/app/app/(app)/dashboard/page.tsx`.
- Current dashboard orchestration exists in `src/components/features/dashboard/useOpsDashboardState.ts`.
- Summary fetching and polling/realtime fallback exist in `src/hooks/ops/useOpsTodaySummary.ts`.
- Booking-level realtime invalidation exists in `src/hooks/ops/useBookingRealtime.ts`.
- Booking summary shaping exists in `server/ops/bookings.ts`.

## Constraints & Risks

- Dashboard has multiple overlapping client state systems: React Query, booking state machine, offline queue, and realtime invalidation.
- Existing worktree has unrelated changes that must not be touched.
- Refactor must preserve optimistic booking actions and URL-driven state.

## Recommended Direction

- Implement the refactor in-place in phased slices, starting with a unified dashboard data hook and shared Supabase browser client.
- Normalize server booking rows for rendering to reduce client-side list work.
