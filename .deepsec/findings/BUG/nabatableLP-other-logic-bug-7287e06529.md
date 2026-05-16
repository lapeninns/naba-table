# [BUG] Failed Google publish can be returned as HTTP 200

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/publish/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/publish/route.ts#L55-L77) (lines 55, 71, 76, 77)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route always returns a successful JSON response after publishFoodMenusProjectionToGoogle resolves. That helper catches Google update failures and returns an attempt with status failed and googleResponse null instead of throwing, so this handler can return HTTP 200 for a publish that did not reach Google.

## Recommendation

Check result.attempt.status in the route and return an error status when it is not succeeded, or change publishFoodMenusProjectionToGoogle to throw after recording the failed attempt.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

**Verdict:** fixed

The FoodMenus publish route now receives a rejected service call when Google
publishing fails after preflight, so it returns the existing error response path
instead of HTTP 200 with a failed attempt.

Evidence:

- `server/google-business-profile/food-menus-sync.ts` throws after persisting the
  failed attempt.
- `tests/server/google-business-profile-food-menus-routes.test.ts` covers the
  route returning HTTP 500 for a failed Google FoodMenus publish.
- `pnpm exec vitest run tests/server/google-business-profile-food-menus-routes.test.ts`
