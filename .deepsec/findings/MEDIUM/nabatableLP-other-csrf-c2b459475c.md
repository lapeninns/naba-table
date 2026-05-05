# [MEDIUM] Google FoodMenus publish does not validate CSRF tokens

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/publish/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/publish/route.ts#L22-L55) (lines 22, 28, 38, 55)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler authenticates the user with cookie-bound Supabase auth through ensureRestaurantAdminAccess, parses the JSON body, and publishes to Google, but it never calls validateCsrfToken or checks the x-csrf-token header. The frontend helper sends a CSRF token, but this route ignores it. A same-site attacker/browser context that can issue credentialed requests could trigger a publish as an authenticated restaurant admin.

## Recommendation

Call validateCsrfToken(request) before parsing the body or performing the publish, and return 403 on failure. Keep the existing admin membership check.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)
