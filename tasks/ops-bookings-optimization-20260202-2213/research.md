---
task: ops-bookings-optimization
timestamp_utc: 2026-02-02T22:13:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Bookings Performance

## Requirements

- Apply dashboard performance improvements to `/app/bookings`.
- Replace pagination with virtualized infinite scrolling while preserving booking actions.
- Maintain API constraints (ops bookings API caps `pageSize` at 50).

## Existing Patterns & Reuse

- Ops bookings route uses `OpsBookingsClient` and `BookingsTable`.
- Dashboard optimizations include virtualization, memoized handlers, and cached rendering.

## Constraints & Risks

- Maintain booking actions correctness and realtime/polling behavior.
- Follow AGENTS: Shadcn primitives, a11y, Chrome DevTools MCP for UI.

## Recommended Direction

- Use window virtualization with `@tanstack/react-virtual` inside `BookingsTable`.
- Switch to infinite loading with `pageSize=50` and remove pagination UI.
