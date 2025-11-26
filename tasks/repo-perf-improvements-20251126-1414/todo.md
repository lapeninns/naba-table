---
task: repo-perf-improvements
timestamp_utc: 2025-11-26T14:14:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [ ] Confirm queryKeys helper location or create minimal shared keys module.
- [ ] Enable React Query Devtools in dev for verification (if not already).
- [ ] Inventory existing loading spinners and shortcut handlers.

## Core

- [ ] Implement optimistic updates for toggles, create/delete, booking status; add rollbacks + toasts.
- [ ] Add smart prefetching on nav hovers, wizard steps, calendar adjacents, restaurant switcher.
- [ ] Tune staleTime/cacheTime per data type; add targeted invalidations.
- [ ] Add debounced inputs (search/filters) and throttled scroll/resize handlers where present.
- [ ] Add memoization (React.memo/useMemo/useCallback) to hotspot lists/components.
- [ ] Introduce network hygiene: cancel superseded requests, avoid redundant refetch.

## UI/UX

- [ ] Replace key spinners with skeletons; wrap sections in Suspense where stable.
- [ ] Implement scoped keyboard shortcuts (Cmd/Ctrl+S, Cmd/Ctrl+N, Esc, Cmd/Ctrl+K if palette).
- [ ] Apply code splitting/lazy loading to heavy routes/components (settings tabs, wizard steps, charts, modals).
- [ ] Optimize images/assets via Next/Image and lazy loading; trim icon/libs if heavy.
- [ ] Ensure animations use transform/opacity; add prefers-reduced-motion guard.

## Tests

- [ ] Unit tests for optimistic updater utilities, debounce/throttle hooks, shortcut guard.
- [ ] Integration tests for optimistic flows and error rollback.
- [ ] A11y checks: axe, keyboard traversal, aria-busy on loading regions.
- [ ] Performance sampling: request count reduction, bundle analyzer snapshot, Lighthouse.

## Notes

- Assumptions: No API contract changes; backend supports current mutation semantics.
- Deviations: Note any shortcuts skipped due to browser conflicts; any Suspense scope reduced due to instability.

## Batched Questions

- [ ] Are there specific screens prioritized for skeleton rollout? (ask PM/design)
- [ ] Which pages are most used for bundle analyzer targeting? (ask analytics)
