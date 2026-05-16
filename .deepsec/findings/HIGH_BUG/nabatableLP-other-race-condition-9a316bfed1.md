# [HIGH_BUG] FoodMenus review replacement and decisions are not atomic

**File:** [`src/components/features/restaurant-settings/dual-sync/FoodMenusImportReviewPanel.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/dual-sync/FoodMenusImportReviewPanel.tsx#L290-L367) (lines 290, 367)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The refresh action started from line 290 reaches replacePendingFoodMenusImportReviews, which marks all pending rows superseded and then inserts the new review rows as separate operations. If insertion fails after the supersede update, the pending review queue is lost. The decision action submitted at line 367 reaches decideFoodMenusImportReview, which reads a pending review, performs menu side effects, and only then marks the review decided; the final update does not constrain decision_status to pending. Concurrent or replayed submissions can apply stale/conflicting side effects and leave the audit row reflecting whichever write wins last.

## Recommendation

Move review replacement and review decision application into transactional database RPCs. For decisions, claim the row with a conditional pending-status update before side effects, or perform the side effect and status transition in one transaction with row locking/idempotency.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

**Verdict:** fixed

Pending-review replacement now goes through the `replace_pending_food_menus_import_reviews` service-role RPC added in `20260516094700_atomic_foodmenus_import_reviews.sql`, so superseding old pending rows and inserting the fresh review batch happen inside one database function call. Decision handling now claims `pending -> processing` before side effects and finalizes only from `processing`. Focused evidence: `tests/server/google-business-profile-food-menus-storage.test.ts` passed on 2026-05-16 and verifies replacement uses the RPC and final decision marking requires the claimed state; `tests/server/google-business-profile-food-menus-sync.test.ts` verifies side effects do not run when the claim is lost.
