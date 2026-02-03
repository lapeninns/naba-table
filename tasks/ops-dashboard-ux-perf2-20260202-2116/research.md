---
task: ops-dashboard-ux-perf2
timestamp_utc: 2026-02-02T21:16:20Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Dashboard Additional UX/Perf Optimizations

## Requirements

- Keep ops dashboard behavior unchanged.
- Improve smoothness and reduce render/network work.
- Avoid new dependencies unless necessary.
- Maintain a11y and Shadcn usage.

## Existing Patterns & Reuse

- React Query for summary data and realtime updates.
- `useBookingRealtime` refetches summary on realtime updates.
- `BookingsList` uses per-minute clock and memoized list operations.

## External Resources

- Vercel React Best Practices (rerender-memo, bundle-dynamic-imports, rendering-content-visibility).

## Constraints & Risks

- DevTools MCP verification blocked without env vars.
- Any changes to realtime/query behavior must keep data freshness and action correctness.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Remove duplicate summary fetch in realtime hook and consume existing summary cache.
- Pause per-minute clock updates when tab is hidden.
- Apply `content-visibility` to booking list container.
- Share date/time formatters to reduce per-card formatter allocations.

## Collaboration (roles)

- Lead: @amanshresthaa (implementation + artifacts)
- Research: subagents reviewed realtime hook, visibility pattern, and formatter reuse recommendations.
