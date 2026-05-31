# [HIGH] Authenticated users can create zones for any restaurant

**File:** [`src/app/api/onboarding/restaurant/[id]/zones/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/onboarding/restaurant/[id]/zones/route.ts#L27-L59) (lines 27, 28, 38, 55, 59)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler takes restaurantId from the URL, checks only that a Supabase user exists, and performs no per-restaurant membership or role check. It then uses getServiceSupabaseClient and passes the attacker-controlled restaurantId into createZone, which directly inserts a zones row for that restaurant. This lets any authenticated user add or alter dining zones in another tenant's restaurant when they know the restaurant id.

## Recommendation

Require membership or admin membership for restaurantId before creating zones. Do the authorization check before constructing or using the service-role client, and reject users who do not belong to the target restaurant.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
