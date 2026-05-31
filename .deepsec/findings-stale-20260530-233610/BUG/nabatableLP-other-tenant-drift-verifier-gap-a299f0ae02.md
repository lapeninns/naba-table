# [BUG] Scoped adjacency verification ignores cross-restaurant edges

**File:** [`scripts/verify-zone-adjacencies.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/scripts/verify-zone-adjacencies.ts#L177-L189) (lines 177, 188, 189)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-tenant-drift-verifier-gap`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

When RESTAURANT_SLUG is set, the script queries adjacency rows where either endpoint is one of the restaurant's tables, but then silently skips any row where both endpoints are not in the scoped table set. That means an invalid adjacency from a scoped restaurant table to another restaurant's table is not counted as an extra edge, even though the all-to-all within-zone invariant should reject it. A per-restaurant verification run can therefore report ok while cross-tenant adjacency drift involving that restaurant remains in public.table_adjacencies.

## Recommendation

When scoped to a restaurant, treat rows with exactly one endpoint in the scoped table set as invalid cross-scope extras, or report them separately as crossRestaurantEdges and fail the check.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
