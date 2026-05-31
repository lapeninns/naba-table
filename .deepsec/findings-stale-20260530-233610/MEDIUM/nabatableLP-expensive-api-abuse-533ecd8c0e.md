# [MEDIUM] Manual Google refresh endpoint has no abuse throttle

**File:** [`src/app/api/ops/restaurants/[id]/dual-sync/refresh/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/dual-sync/refresh/route.ts#L37-L41) (lines 37, 41)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler verifies restaurant admin membership, but then directly calls refreshFromGoogle without any per-user or per-restaurant rate limit, cooldown, or in-flight lock. refreshFromGoogle opens a snapshot run and calls Google Business Profile refresh paths, including syncGoogleBusinessProfileBusinessInformation and food-menu refresh. A compromised or abusive admin account can repeatedly POST to this route to consume Google API quota, create repeated sync runs, and put load on the database/provider integrations. Backend auth prevents unauthenticated abuse, so this is limited to authenticated admin abuse.

## Recommendation

Apply consumeRateLimit with a key scoped to userId and restaurantId, and add a per-restaurant single-flight lock or short cooldown so concurrent refreshes return 409/429 instead of starting another provider pull.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)
