# [HIGH_BUG] Review decisions are not atomically claimed before side effects

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/[reviewId]/decision/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/[reviewId]/decision/route.ts#L79) (lines 79)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route delegates to decideFoodMenusImportReview, which reads the review as pending, performs side effects such as item creation/update/delete, and only then marks the review decided. The storage update is not conditional on decision_status still being pending, and the side effects plus decision update are not wrapped in one transaction. Concurrent requests for the same review can both observe pending and apply conflicting actions, while a failure after a side effect can leave the review pending and replayable.

## Recommendation

Atomically claim the review first with an UPDATE ... WHERE id = ? AND restaurant_id = ? AND decision_status = 'pending' RETURNING \* or a transactional RPC/row lock. Make side effects idempotent and only allow the final decision update from the claimed state.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

**Verdict:** fixed

`decideFoodMenusImportReview` now claims the row before menu side effects by transitioning `decision_status` from `pending` to `processing` with restaurant/review/status predicates. If the claim returns no row, the decision aborts before applying canonical menu changes. The final decision update now requires `decision_status = 'processing'`, so an unclaimed or concurrently handled review cannot overwrite the outcome. Focused evidence: `tests/server/google-business-profile-food-menus-sync.test.ts` passed on 2026-05-16 and verifies the lost-claim path does not call menu side-effect helpers or final marking.
