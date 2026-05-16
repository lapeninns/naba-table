# [BUG] Import review decisions execute side effects before atomically claiming the review

**File:** [`server/google-business-profile/food-menus-sync.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/food-menus-sync.ts#L335-L477) (lines 335, 345, 404, 432, 477)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

decideFoodMenusImportReview reads a review, checks that it is pending, performs the requested side effect such as settings updates, item creation, item patching, or deletion, and only then marks the review as applied or ignored. Concurrent requests can both observe the same pending review and execute conflicting side effects before either status update is visible.

## Recommendation

Atomically claim the review before applying side effects, for example by updating it from pending to processing with a WHERE decision_status='pending' guard, then perform the mutation and final status update in a transaction/RPC.

## Revalidation

**Verdict:** fixed

`decideFoodMenusImportReview` now validates the action and calls `claimFoodMenusImportReviewDecision` before the first menu/settings side effect. The claim transitions `decision_status` from `pending` to `processing` with restaurant/review/status predicates, and final marking now requires `decision_status = 'processing'`. Focused evidence: `tests/server/google-business-profile-food-menus-sync.test.ts` passed on 2026-05-16 and verifies side effects do not run when the pending claim is lost.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)
