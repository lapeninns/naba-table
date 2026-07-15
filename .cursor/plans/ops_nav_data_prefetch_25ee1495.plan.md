---
name: Ops nav data prefetch
overview: Warm safe, cache-aligned React Query data on ops sidebar intent for Bookings and Customers without prefetching arbitrary URL params, and optionally reduce accidental prefetch noise via debounced hover.
todos:
  - id: prefetch-customers-infinite
    content: 'Add /customers branch: prefetchInfiniteQuery page 1 with params matching hooks/useOpsCustomers.ts + queryKeys.opsCustomers.list'
    status: pending
  - id: prefetch-bookings-summary
    content: 'Add /bookings branch: prefetchQuery status summary for restaurantId with null from/to (match useOpsBookingStatusSummary default landing)'
    status: pending
  - id: debounce-sidebar-prefetch
    content: 'Optional: debounce onMouseEnter/onFocus prefetch in OpsSidebarLayout (200–300ms) without affecting click navigation'
    status: pending
  - id: tests-and-verify
    content: Add unit test for default customers prefetch params/key parity; run typecheck; manual ops route hover→nav verify
    status: pending
isProject: false
---

# Ops Bookings / Customers prefetch optimization

## Current state

- [`src/components/features/ops-shell/useOpsRoutePrefetch.ts`](src/components/features/ops-shell/useOpsRoutePrefetch.ts) handles `/dashboard` and several `/settings/restaurant/*` paths only. Sidebar [`OpsSidebarLayout.tsx`](src/components/features/ops-shell/OpsSidebarLayout.tsx) still calls `prefetchRoute` on `mouseenter` / `focus` for **every** nav item, including `/bookings` and `/customers`, where the callback is currently a no-op for RQ data.
- [`hooks/useOpsCustomers.ts`](hooks/useOpsCustomers.ts) already uses `placeholderData` for infinite list transitions; query keys are **stable** for the default filter set (same normalization as the live hook).
- Ops bookings list ([`src/hooks/ops/useOpsBookingsList.ts`](src/hooks/ops/useOpsBookingsList.ts)) keys include `normalizeFilters` output with **`from` derived from `new Date()`** inside [`buildOpsBookingsFilters`](src/utils/ops/buildOpsBookingsFilters.ts) for the default **upcoming + no service date** case. A sidebar prefetch that builds filters with `now` at hover time will usually **not** match the cache key on the bookings page’s first render a second later, so **prefetching the infinite bookings list from the sidebar is low ROI** unless keys are stabilized separately (larger follow-up).

## Recommended approach (phased)

### Phase 1 — High confidence, low risk

1. **Customers: `prefetchInfiniteQuery` for page 1 only** in `useOpsRoutePrefetch` when `path === '/customers'` (and `/app` stripping already handled). Reuse the **exact** parameter object shape used by [`hooks/useOpsCustomers.ts`](hooks/useOpsCustomers.ts): `restaurantId`, `pageSize: INFINITE_PAGE_SIZE` (50 from [`opsCustomersTypes.ts`](src/components/features/customers/opsCustomersTypes.ts)), and the same defaults (`sort`, `sortBy`, `marketingOptIn`, `lastVisit`, `minBookings`, no `search`). Use `queryKeys.opsCustomers.list(normalizedParams)`, `initialPageParam: 1`, and `getNextPageParam` mirroring the hook so the prefetched cache matches navigation.
2. **Bookings: prefetch the status summary query only** for `path === '/bookings'`. The hook [`useOpsBookingStatusSummary`](src/hooks/ops/useOpsBookingStatusSummary.ts) uses a dedicated key (`['ops','bookings','status-summary', ...]`) with `from`/`to` derived via `toIsoDateParam`; for the common **no service-date** landing, [`useOpsBookingsDataState`](src/components/features/bookings/useOpsBookingsDataState.ts) passes `from`/`to` as **null**, which is **stable** and safe to warm on hover. Call `bookingService.getStatusSummary` with the same arguments as the hook for that case (`staleTime` 30_000 to align).
3. **Optional UX guard:** debounce hover/focus prefetch (e.g. 200–300ms) in [`OpsSidebarLayout.tsx`](src/components/features/ops-shell/OpsSidebarLayout.tsx) so quick pointer passes do not trigger network work. Apply to the **prefetch callback only** (not navigation / offline guards).

### Phase 2 — Optional follow-up (only if list warm-cache is still a priority)

- **Stabilize or bucket** the query key for “upcoming, unscoped” bookings where `from` is effectively “now” (e.g. minute-level bucket or a sentinel in the key with documented semantics), then add `prefetchInfiniteQuery` for the first bookings page from the sidebar. This touches [`useOpsBookingsList`](src/hooks/ops/useOpsBookingsList.ts) / `normalizeFilters` behavior and needs careful regression testing.

## Verification

- Run `pnpm run typecheck` and targeted tests if new helpers/tests are added.
- Browser verification on a **real shipped ops route** (e.g. app host bookings/customers), not only `__dev` harnesses.

## Files likely to change

- [`src/components/features/ops-shell/useOpsRoutePrefetch.ts`](src/components/features/ops-shell/useOpsRoutePrefetch.ts) — add `/bookings` and `/customers` branches; optionally extract a tiny pure `buildDefaultOpsCustomersListParams(restaurantId)` next to the hook or under `lib/` if it aids testing.
- [`src/components/features/ops-shell/OpsSidebarLayout.tsx`](src/components/features/ops-shell/OpsSidebarLayout.tsx) — optional debounced prefetch wrapper.
- New or existing unit test under `tests/` for **query key / param parity** between prefetch helpers and [`hooks/useOpsCustomers.ts`](hooks/useOpsCustomers.ts) (and status-summary args if extracted).
