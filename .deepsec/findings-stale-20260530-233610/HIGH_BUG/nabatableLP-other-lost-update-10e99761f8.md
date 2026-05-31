# [HIGH_BUG] Partial details updates can overwrite concurrent changes with stale values

**File:** [`server/restaurants/details.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/details.ts#L228-L275) (lines 228, 231, 260, 275)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-lost-update`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

updateRestaurantDetails reads the current restaurant, merges omitted fields from that snapshot, then sends a full update payload. Two concurrent partial updates that start from the same snapshot can clobber each other: the later write includes stale values for unrelated fields and overwrites the earlier write. This is especially risky because internal sync/import paths call this helper with partial field updates.

## Recommendation

Only send fields that are actually present in the input, or use optimistic concurrency with updated_at/version checks. If a full replacement API is needed, make that contract explicit and separate from the partial-update helper.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
