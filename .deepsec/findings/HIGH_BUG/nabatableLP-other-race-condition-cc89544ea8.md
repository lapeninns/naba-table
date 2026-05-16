# [HIGH_BUG] Import review decisions can replay or conflict under concurrent submits

**File:** [`server/google-business-profile/food-menus-sync.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/food-menus-sync.ts#L335-L1299) (lines 335, 345, 370, 432, 463, 477, 1299)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

decideFoodMenusImportReview reads the review and checks decisionStatus === 'pending' in application code, but applies the requested side effects before marking the review decided. Metadata updates, item creation, item patching, and missing-local delete/update actions all happen before the final decision update. Without a transaction or pending compare-and-set, concurrent requests for the same review can both observe pending and execute conflicting actions; a failure after the side effect can also leave the review pending and replayable.

## Recommendation

Atomically claim the review before side effects, for example by transitioning pending -> processing with restaurant_id, review_id, and decision_status predicates and checking exactly one row. Prefer a transactional RPC that performs the claim, side effect, and final decision update together where possible.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
