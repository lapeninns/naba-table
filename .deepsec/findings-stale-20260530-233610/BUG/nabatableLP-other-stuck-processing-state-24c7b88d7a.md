# [BUG] FoodMenus decisions can be left permanently in processing state after partial failure

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/[reviewId]/decision/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/[reviewId]/decision/route.ts#L80) (lines 80)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-stuck-processing-state`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route calls decideFoodMenusImportReview after backend admin and CSRF checks. In the downstream decision service, the review is first claimed by changing decision_status from pending to processing, then menu/settings side effects are applied, and only afterward the review is marked applied or ignored. If any post-claim operation fails, the route returns an error but there is no rollback or failure-state reset. The storage layer only allows future decisions for pending reviews, and refresh replacement supersedes only pending rows, so the specific review can remain stuck in processing with ambiguous side effects. This is not an auth bypass, but it is a real state-management bug in this mutation path.

## Recommendation

Make the claim, side effects, and final review status transition atomic where possible, or add a catch path that marks the review failed/retryable. Avoid leaving processing as a terminal state after service exceptions.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
