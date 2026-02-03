---
task: ops-dashboard-optimization
timestamp_utc: 2026-02-02T20:26:55Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Research: Ops Dashboard Performance Optimization

## Requirements

- Functional:
  - Ops dashboard (`/dashboard` → `/app/dashboard`) remains behaviorally identical.
  - No regressions in booking actions, filters, sorting, pagination, or search.
- Non-functional:
  - Reduce render cost and input latency (search/filter/sort).
  - Preserve accessibility and keyboard navigation.
  - Avoid new dependencies unless strictly necessary.

## Existing Patterns & Reuse

- React Query with `placeholderData: keepPreviousData` for summary fetch.
- `useTransition` for URL updates on date changes.
- Memoization via `useMemo` in list filtering and sorting.
- `HeatmapCalendar` already tracks its open state locally.

## External Resources

- Vercel React Best Practices (rerender-memo, rerender-dependencies, rendering-content-visibility).

## Constraints & Risks

- Heatmap data used for header badges must remain accurate.
- Changes must respect Shadcn primitives and a11y requirements.
- Chrome DevTools MCP is mandatory for UI verification.

## Open Questions (owner, due)

- None.

## Recommended Direction (with rationale)

- Defer search filtering with `useDeferredValue` and memoized selectors to reduce blocking renders.
- Reduce list recomputation on per-minute `now` updates by avoiding `now` dependency unless needed.
- Lazy-load heatmap data when calendar opens and use summary totals for header counts to preserve correctness.
- Memoize DTO mapping for bookings to avoid repeated per-render object creation.
