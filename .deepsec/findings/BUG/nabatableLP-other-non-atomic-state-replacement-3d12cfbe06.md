# [BUG] Pending FoodMenus reviews can be lost during replacement

**File:** [`server/google-business-profile/food-menus-storage.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/food-menus-storage.ts#L675-L720) (lines 675, 681, 715, 720)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-non-atomic-state-replacement`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

replacePendingFoodMenusImportReviews first marks every pending review for the restaurant as superseded, then inserts the replacement review rows as a separate database operation. If the insert fails because of a transient database error, constraint error, or process interruption after the supersede update, the previous pending review queue is already hidden and no replacement rows are available.

## Recommendation

Move the supersede-and-insert sequence into one transactional database RPC, or insert replacements under a new generation/run id and atomically switch the active generation only after the insert succeeds.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
