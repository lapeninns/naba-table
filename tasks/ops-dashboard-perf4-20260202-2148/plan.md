---
task: ops-dashboard-perf4
timestamp_utc: 2026-02-02T21:48:54Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Implementation Plan: Ops Dashboard Perf Tweaks

## Objective

Small safety improvements: invalidate virtual row height cache on status changes and stabilize handler props.

## Success Criteria

- [ ] Height cache resets when a booking status changes.
- [ ] Handler props are memoized to avoid extra renders.

## Components

- `src/components/features/dashboard/BookingsList.tsx`
- `src/components/features/dashboard/OpsDashboardClient.tsx`

## Testing Strategy

- `pnpm run typecheck`.
- DevTools MCP when env vars are available.
