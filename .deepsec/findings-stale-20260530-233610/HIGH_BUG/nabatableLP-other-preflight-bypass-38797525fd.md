# [HIGH_BUG] Publish accepts missing expected hashes and can bypass stale-menu protection

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/publish/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/publish/route.ts#L47-L79) (lines 47, 78, 79)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** medium • **Slug:** `other-preflight-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The manual publish route treats expectedGoogleHash and expectedProjectionHash as optional and forwards them directly to publishFoodMenusProjectionToGoogle. The downstream preflight decision only rejects baseline or projection changes when those expected hashes are present; omitting both makes the publish proceed against whatever Google currently returns. An authorized caller can therefore bypass the intended stale-baseline conflict flow by POSTing without hashes, overwriting Google FoodMenus even if Google or Nabatable changed after the operator previewed the projection. This is not an auth bypass, but it can cause external menu data corruption through the shipped publish API.

## Recommendation

Require expectedGoogleHash and expectedProjectionHash for this manual route, or require an explicit audited force-publish flag that is separate from the normal preflighted publish path. Keep hashless calls limited to scheduled/internal paths that deliberately use last-write-wins semantics.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
