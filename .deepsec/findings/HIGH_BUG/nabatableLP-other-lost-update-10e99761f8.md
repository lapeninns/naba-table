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

## Revalidation

**Verdict:** true-positive

updateRestaurantDetails still reads the current restaurant, merges omitted fields from that snapshot, and then builds a full UpdateRestaurantInput payload. updateRestaurant writes every defined field in that payload, so fields omitted by the caller can still be overwritten with values from the stale pre-update snapshot. There is no updated_at/version predicate or compare-and-swap guard around the write. The route can submit partial details, and internal code such as applyProfileImportToCore constructs partial profile updates with only timezone plus one imported field. Two overlapping updates that read the same initial state can therefore clobber each other when the later full payload writes stale unrelated fields. This is a real lost-update bug and the reported HIGH_BUG severity is reasonable for profile/sync data integrity.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
