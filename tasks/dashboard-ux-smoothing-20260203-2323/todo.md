---
task: dashboard-ux-smoothing
timestamp_utc: 2026-02-03T23:23:00Z
owner: github:@amanshresthaa
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Checklist

## Setup

- [x] Create/extend components (Shadcn-first; exception noted if any)
- [ ] Add feature flag (if needed) — not needed

## Core

- [x] Data fetching / mutations (refactor preserved existing hooks)
- [x] Validation & error surfaces (no behavioral changes)
- [x] URL/state sync & navigation (filter/search/sort params + date sync)

## UI/UX

- [x] Responsive layout (preserved)
- [x] Loading/empty/error states (route-level loading added)
- [x] A11y roles, labels, focus mgmt (labels + focus-visible + aria-hidden updates)
- [x] Motion safety (prefers-reduced-motion safeguards)
- [x] Replace `transition-all` with explicit transitions in dashboard UI
- [x] LCP reduction (prefetch summary + keep summary header visible during loading; list deferred)
- [x] TBT reduction (remove CollapsibleContent forced reflow on desktop; reduce list measurement + search indexing)
- [x] TBT reduction (element-based virtualization scroll container; lazy-load PostHog + hide React Query devtools on ops host; disable Sentry replay on ops routes)

## Tests

- [ ] Unit (not run)
- [ ] Integration (not run)
- [ ] E2E (critical flows) (not run)
- [ ] Axe/Accessibility checks (not run)

## Notes

- Assumptions:
- Refactor-only; no behavior change intended.
- Deviations:
- Ops dashboard now prefetches summary on server to reduce hydration wait.

## Batched Questions

-
