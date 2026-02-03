---
task: ops-dashboard-ux-perf2
timestamp_utc: 2026-02-02T21:16:20Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Ops Dashboard Additional UX/Perf Optimizations

## Objective

Further improve ops dashboard responsiveness by reducing redundant network work, pausing unnecessary timers, and reducing render/paint cost.

## Success Criteria

- [ ] No change in functional behavior or ordering.
- [ ] Fewer summary refetches triggered by realtime logic.
- [ ] Reduced CPU work when tab is hidden.
- [ ] Lower paint cost for long lists.

## Architecture & Components

- `src/hooks/ops/useBookingRealtime.ts`
  - Stop refetching summary; consume cached summary and update booking state machine only.
- `src/components/features/dashboard/BookingsList.tsx`
  - Pause clock updates when tab hidden.
  - Add `content-visibility` styling to list container.
- `components/dashboard/OpsBookingCard.tsx`
  - Reuse `Intl.DateTimeFormat` instances via memoized helpers.
- `src/hooks/ops/useOpsTodaySummary.ts`
  - Ensure summary query remains source of truth for data fetches.

## Data Flow & API Contracts

- No API changes. React Query cache remains single source of truth for summary data.

## UI/UX States

- No changes to loading/empty/error states.

## Edge Cases

- When realtime is unhealthy, summary polling still works from `useOpsTodaySummary`.
- If summary cache is empty, realtime hook should not throw.

## Testing Strategy

- Manual ops dashboard smoke.
- Chrome DevTools MCP perf/a11y verification (blocked without env vars).

## Rollout

- No feature flag. Standard release.
