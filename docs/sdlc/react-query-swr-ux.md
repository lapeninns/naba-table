# React Query SWR UX Standard

> **Owner:** `@maintainers` | **Last updated:** 2026-05-03

This document codifies how Nabatable uses TanStack React Query's `placeholderData: keepPreviousData` to create seamless stale-while-revalidate (SWR) transitions.

## Guiding principles

1. **No global default.** `placeholderData` is set **per query** on hooks whose key is driven by filters, dates, pagination, cursor, or search. It is _not_ applied blindly to all queries—see [§ When NOT to use keepPreviousData](#when-not-to-use-keeppreviousdata).
2. **Three loading states.** Every parameterized query that uses `keepPreviousData` should render exactly three states, not two.
3. **Toolbar stays interactive.** `StaleBoundary` wraps only the content body; search fields, date pickers, and filter controls are never dimmed or blocked.

## The three loading states

| State                         | RQ v5 signal                                 | UI treatment                                         |
| ----------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| **Initial / structural load** | `isPending && !isPlaceholderData`            | Full skeleton matching the target layout             |
| **Same-key refresh**          | `isFetching && !!data && !isPlaceholderData` | Small "Updating…" badge or spinner in toolbar/header |
| **Param-change stale**        | `isFetching && isPlaceholderData`            | Wrap content in `StaleBoundary` (opacity + blur)     |

Use `lib/query/swrUiState.ts` → `getSwrUiState(query)` to compute these flags instead of hand-rolling the boolean logic in each component.

## `StaleBoundary` primitive

Located at `components/ui/stale-boundary.tsx`. Ships as part of the shadcn primitive layer.

```tsx
import { StaleBoundary } from '@/components/ui/stale-boundary';

<StaleBoundary isStale={swr.isPlaceholderStale}>
  <BookingList items={data.items} />
</StaleBoundary>;
```

### Accessibility

- Sets `aria-busy="true"` when stale.
- Sets `inert` and `aria-hidden="true"` when stale so stale content cannot be activated by keyboard while controls outside the boundary stay usable.
- `blur-[1px]` is gated behind `motion-safe:` — reduced-motion users see opacity only.

### Content-only wrapping

**Golden rule:** `StaleBoundary` wraps only the main list / grid / detail body. Toolbar controls, filter bars, and date pickers stay outside and remain fully interactive.

```
┌─ Toolbar ────────────────────────────────┐
│  [Filters] [Search…]    ↻ Updating…     │  ← stays interactive
├──────────────────────────────────────────┤
│  ┌─ StaleBoundary isStale ─────────────┐ │
│  │  List / Grid / Detail body          │ │  ← dimmed when stale
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

## Adding `keepPreviousData` to a hook

1. Import `keepPreviousData` from `@tanstack/react-query`.
2. Add `placeholderData: keepPreviousData` to the `useQuery` options.
3. In the consuming component, use `getSwrUiState(query)` and wire the three states.
4. Wrap the content body in `StaleBoundary` when `isPlaceholderStale` is true.

### Example hook change

```diff
 import {
+  keepPreviousData,
   useQuery,
 } from '@tanstack/react-query';

 return useQuery({
   queryKey,
   queryFn,
   enabled,
+  placeholderData: keepPreviousData,
 });
```

## When NOT to use `keepPreviousData`

- **Identity-changing keys.** When the `queryKey` change means "I navigated to a different entity" (e.g. a different `restaurantId`, `bookingId`, or `customerId`), showing the old entity's data is **incorrect**, not helpful. Use a skeleton instead.
- **Queries with no user-driven key changes.** Static config queries, single-entity detail fetches with a stable key—`keepPreviousData` adds no value when the key never changes.
- **SSR/guest per-request clients.** Guest pages often use per-request `QueryClient` instances; `keepPreviousData` mainly benefits client-side navigations.

## Domain-specific composition

Some screens compute stale state from domain logic rather than (or in addition to) RQ's `isPlaceholderData`. The canonical example is the ops dashboard's `isSummaryMismatch`:

```ts
const swr = getSwrUiState(summaryQuery);
const isStaleUi = swr.isPlaceholderStale || isSummaryMismatch;
```

This composes cleanly because `StaleBoundary` only cares about a boolean `isStale` prop.

## Hooks audit status

Hooks that already use `keepPreviousData`:

- `hooks/useBookings.ts`
- `hooks/useOpsBookings.ts`
- `src/hooks/ops/useOpsDashboardData.ts`
- `src/hooks/ops/useOpsEmailDeliverySummary.ts`
- `src/hooks/ops/useOpsEmailDeliveryFeed.ts`
- `src/hooks/ops/useOpsBookingStatusSummary.ts`
- `src/hooks/ops/useOpsTableTimeline.ts`
- `src/hooks/ops/useOpsMenu.ts` → `useOpsMenuList`
- `src/hooks/ops/useOpsDualSync.ts` → `operationsQuery`, `publishJobsQuery`

> [!NOTE]
> `src/hooks/ops/useOpsBookingsList.ts` is an infinite query and uses the equivalent `placeholderData: (previous) => previous`. `getSwrUiState` accepts it via the structural `SwrUiStateSource` type.

## Feature-level `StaleBoundary` adoption

| Feature            | Hook                      | Uses `getSwrUiState` | Uses `StaleBoundary` | Notes                                                  |
| ------------------ | ------------------------- | -------------------- | -------------------- | ------------------------------------------------------ |
| Ops dashboard      | `useOpsDashboardData`     | ✅                   | ✅                   | Composed with `isSummaryMismatch` via `isStaleContent` |
| Ops bookings       | `useOpsBookingsList`      | ✅                   | ✅                   | List body only; toolbar/search stay interactive        |
| Ops email delivery | `useOpsEmailDeliveryFeed` | ✅                   | ✅                   | Delivery-log table only; filter bar/pagination outside |

When adopting `StaleBoundary` in a new feature:

1. Call `getSwrUiState(query)` in the data-state hook.
2. Compose with any domain-specific stale flags.
3. Place `<StaleBoundary>` around the content body only — toolbar/controls stay outside.

## Applies to both shells

Both the main Next.js app (`src/app/providers.tsx`) and the Reserve Vite app (`reserve/app/providers.tsx`) should follow these per-hook rules. Neither shell sets a global `placeholderData` default.
