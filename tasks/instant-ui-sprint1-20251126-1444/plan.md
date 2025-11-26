---
task: instant-ui-sprint1
timestamp_utc: 2025-11-26T14:44:00Z
owner: github:@amankumarshrestha
reviewers: [github:@maintainers]
risk: medium
flags: []
related_tickets: []
---

# Implementation Plan: Sprint 1 — Make the App Feel Instant

## Objective

Deliver optimistic, responsive UX for toggles and booking status changes, reduce over-fetching via tuned caching, introduce skeleton loaders for key screens, and standardize error handling.

## Success Criteria

- [ ] Toggle and booking status actions update UI instantly; failures rollback and show toast.
- [ ] Central query key helper adopted for targeted invalidations; checklist per mutation documented.
- [ ] Explicit staleTime/cacheTime applied per major data type with reduced redundant fetches when navigating.
- [ ] Skeleton loaders replace spinners on settings, booking list, and calendar without layout jump.
- [ ] Error boundaries per main route show friendly fallback with retry and log errors.

## Architecture & Components

- `lib/queryKeys` (or existing equivalent): central query key builder; exported segments for bookings, settings, tables, zones, occasions, schedules, customers.
- Mutation helpers (e.g., `useOptimisticMutation` factory) or standardized pattern within each hook using TanStack v5 `onMutate/onError/onSettled`.
- Toast system: reuse existing provider (likely `react-hot-toast` or Radix Toast); expose `toast.success/error` helpers.
- Skeleton primitives: `SkeletonBlock`, `SkeletonText`, `SkeletonCard`, `SkeletonRow`, `SkeletonGridCell` using Tailwind/Shadcn tokens.
- Error boundary component: `AppErrorBoundary` per route with retry button that triggers `queryClient.invalidateQueries` or boundary reset.

## Data Flow & API Contracts

- Mutations: toggle endpoints (zones/tables/occasions/settings) and booking status endpoints; capture request/response shape from existing services (to be inventoried).
- Optimistic path: snapshot previous cache, update to optimistic state; rollback on error; invalidate/refresh on settle to ensure consistency.
- Cache: per data type staleTime; selective invalidate after mutations instead of global refetch where feasible.

## UI/UX States

- Loading: skeletons matching layout instead of full-page spinner.
- Pending: disable buttons/toggles during mutation; small inline “Saving…” or shimmer on toggle.
- Error: toast + inline error text if present; error boundaries show fallback with retry.
- Success: subtle confirmation toast (where appropriate) and state matches server after settle.

## Edge Cases

- Concurrent mutations on same entity; ensure optimistic updates merge safely (e.g., unique query key per entity id).
- Mutation failure after multiple optimistic changes; rollback must use snapshot keyed by mutation context.
- Booking move to waitlist may affect multiple queries (booking list, calendar cell, counters); need invalidation checklist.
- StaleTime too long for volatile data (bookings); ensure manual invalidation on mutation and when tab refocus triggers refetch if stale.

## Testing Strategy

- Unit: query key helper outputs; mutation helpers snapshot/rollback logic (using Vitest + @tanstack/react-query testing utils).
- Integration: mock server responses for toggles/bookings to validate optimistic UI and rollback (msw tests if feasible); verify toasts displayed.
- Accessibility: axe on skeleton and error fallback components; keyboard focus maintained on retry.
- Manual QA (Phase 4): Chrome DevTools MCP across target screens with slow network and CPU throttling.

## Rollout

- Feature flag: consider `feat.optimistic-ui` wrapping new behavior if risk high; default on in staging, gradual in prod.
- Monitoring: console error logs; optional Sentry hooks if present; track mutation failure rate in logs if available.
- Kill-switch: ability to disable optimistic updates per mutation hook (via option or flag) if regressions found.

## DB Change Plan (if applicable)

- No DB schema changes expected for this sprint.
