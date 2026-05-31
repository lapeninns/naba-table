# [MEDIUM] Google FoodMenus publish endpoint has no abuse throttle

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/publish/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/publish/route.ts#L22-L55) (lines 22, 46, 49, 55)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route performs backend auth and restaurant admin authorization, but after that it does not call the repo's rate-limit helper before doing service-role database writes and Google Business Profile preflight/publish calls. A tenant admin or compromised admin session can loop POST requests to consume shared Google API quota and fill FoodMenus snapshot/publish-attempt storage.

## Recommendation

Apply consumeRateLimit before the Google/DB work using an identifier that includes restaurantId and userId, return 429 on exhaustion, and consider a short per-restaurant publish lock/idempotency key.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)
