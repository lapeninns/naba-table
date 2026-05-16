# [BUG] Google FoodMenus publish failures resolve as normal results

**File:** [`server/google-business-profile/food-menus-sync.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/google-business-profile/food-menus-sync.ts#L594-L634) (lines 594, 626, 627, 634)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

publishFoodMenusProjectionToGoogle catches errors from updateGoogleBusinessProfileFoodMenus, records the attempt as failed, and returns a resolved result with googleResponse null. Callers that treat resolution as success can report a failed Google write as a successful publish unless they explicitly inspect attempt.status.

## Recommendation

Either throw after recording the failed attempt, or return a discriminated result type that forces callers to handle failed attempts. Update API callers to return an error status when attempt.status is not succeeded.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
