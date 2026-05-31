# [HIGH_BUG] Manual refresh can create an unbounded queue refetch loop

**File:** [`src/components/features/email-delivery/components/OpsEmailQueuePanel.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/email-delivery/components/OpsEmailQueuePanel.tsx#L123-L159) (lines 123, 157, 159)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-refetch-loop`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The manual refresh effect depends on the entire `query` object returned by `useOpsEmailQueueFeed`. React Query result objects are not referentially stable, and refetching changes fields such as `isFetching` and `dataUpdatedAt`, causing a new object identity. After `refreshKey` is incremented once, it remains non-zero, so each render can rerun the effect and call `query.refetch()` again. This can continuously hit `/api/ops/email-queue`, which loads all queue jobs before filtering and then loads booking rows, creating runaway backend load and a permanently refreshing UI.

## Recommendation

Do not include the whole query result object in the effect dependencies. Depend on a stable `refetch` reference and `refreshKey`, and guard with a `useRef` storing the last handled refresh key so each increment triggers exactly one refetch.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
