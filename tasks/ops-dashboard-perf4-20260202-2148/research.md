---
task: ops-dashboard-perf4
timestamp_utc: 2026-02-02T21:48:54Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: low
flags: []
related_tickets: []
---

# Research: Ops Dashboard Perf Tweaks

## Requirements

- Invalidate row height cache when booking status changes.
- Memoize booking action handlers more aggressively.

## Existing Patterns & Reuse

- Row height cache in `BookingsList` keyed by booking id.
- Action handlers in `OpsDashboardClient` are currently inline functions.

## Constraints & Risks

- Preserve behavior and a11y.

## Recommended Direction

- Track previous status per booking id and invalidate cached height when status changes.
- Wrap action handlers with `useCallback` to stabilize function identity.
