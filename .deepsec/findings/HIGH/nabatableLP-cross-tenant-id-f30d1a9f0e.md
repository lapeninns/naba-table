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

## Revalidation

**Verdict:** fixed

The current zones POST handler now calls withRestaurantAuthorization with CSRF enabled and RESTAURANT_ADMIN_ROLES before validating the body or using the service-role client. That guard rejects invalid restaurant ids, unauthenticated requests, CSRF failures, users without membership for the requested restaurant, and members whose role is not owner or manager. The createZone call still inserts with a service-role client, but the attacker-controlled restaurantId reaches it only after the per-restaurant admin check succeeds. A user authenticated for a different restaurant therefore cannot create zones under the target tenant. Commit 020a7389 added the RESTAURANT_ADMIN_ROLES import and withRestaurantAuthorization call and removed the old generic getUser-only authorization flow. The targeted regression tests passed and verify onboarding routes do not construct service clients when restaurant authorization fails.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
