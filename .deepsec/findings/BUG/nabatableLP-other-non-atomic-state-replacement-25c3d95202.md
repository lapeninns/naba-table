# [BUG] Pending import reviews are superseded before replacement rows are safely inserted

**File:** [`server/google-business-profile/food-menus-storage.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/food-menus-storage.ts#L660-L715) (lines 660, 675, 715)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-non-atomic-state-replacement`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

replacePendingFoodMenusImportReviews first updates every pending review for the restaurant to decision_status='superseded' and only afterwards inserts the replacement review rows. If the insert fails because of a transient database error, constraint violation, or payload issue, the old pending review set has already been hidden and the caller is left with no pending reviews. This is a non-atomic replace operation on approval data.

## Recommendation

Move the supersede-and-insert sequence into one database transaction/RPC, preferably guarded by a per-restaurant advisory lock. Only supersede old rows if the replacement insert succeeds.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
