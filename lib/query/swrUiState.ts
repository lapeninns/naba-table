/**
 * SWR UI-state helper for React Query v5.
 *
 * Maps a `UseQueryResult` to a discriminated "holy trinity" of loading states
 * so consumers don't have to hand-roll the same flag logic in every component.
 *
 * | State             | Condition                                    | Typical UI                       |
 * |-------------------|----------------------------------------------|----------------------------------|
 * | `isInitialLoad`   | No data at all, first fetch in flight        | Full skeleton / spinner          |
 * | `isRefetching`    | Same-key refetch while data is already shown | Small "Updating…" toolbar badge  |
 * | `isPlaceholderStale` | Key changed, previous data shown as placeholder | `StaleBoundary` on content body |
 *
 * For domain-specific stale detection (e.g. dashboard `isSummaryMismatch`),
 * compose with this helper:
 * ```ts
 * const isStaleUi = swr.isPlaceholderStale || isSummaryMismatch;
 * ```
 *
 * @see docs/sdlc/react-query-swr-ux.md
 */

import type { UseQueryResult } from '@tanstack/react-query';

/**
 * Structural subset of a query result that the helper reads. Declared as a
 * `Pick` so both `UseQueryResult` and `UseInfiniteQueryResult` (e.g. the ops
 * bookings list) can be passed without casts.
 */
export type SwrUiStateSource = Pick<
  UseQueryResult<unknown>,
  'isPending' | 'isFetching' | 'isPlaceholderData' | 'data'
>;

export type SwrUiState = {
  /** First load ever — no data, no placeholder. Show full skeleton. */
  isInitialLoad: boolean;
  /** Same-key background refetch while real data is on screen. Show subtle indicator. */
  isRefetching: boolean;
  /** Key changed, previous data shown via `placeholderData`. Wrap content in `StaleBoundary`. */
  isPlaceholderStale: boolean;
};

/**
 * Derive SWR loading-state flags from any `UseQueryResult`.
 *
 * Works correctly regardless of whether the query uses `placeholderData`.
 * When a query does *not* use `placeholderData`, `isPlaceholderStale` will
 * always be `false` and the helper degrades cleanly to `isInitialLoad` /
 * `isRefetching`.
 */
export function getSwrUiState(query: SwrUiStateSource): SwrUiState {
  const { isPending, isFetching, isPlaceholderData, data } = query;

  return {
    isInitialLoad: isPending && isFetching && !isPlaceholderData,
    isRefetching: isFetching && !!data && !isPlaceholderData,
    isPlaceholderStale: isFetching && isPlaceholderData,
  };
}

/**
 * React hook version that returns a stable-reference object.
 *
 * Prefer the plain `getSwrUiState` function when memoisation is not needed;
 * use this hook in render paths where the object identity matters for
 * downstream `useMemo` dependencies.
 */
export { getSwrUiState as swrUiState };
