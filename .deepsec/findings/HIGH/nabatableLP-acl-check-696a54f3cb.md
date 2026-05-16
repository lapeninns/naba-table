# [HIGH] Any authenticated user can create tables for arbitrary restaurants

**File:** [`src/app/api/onboarding/restaurant/[id]/tables/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/onboarding/restaurant/[id]/tables/route.ts#L33-L65) (lines 33, 34, 44, 61, 64, 65)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler only checks that a Supabase user exists, then trusts the URL `id` as `restaurantId` and inserts rows with `getServiceSupabaseClient()`, which bypasses RLS. There is no `requireMembershipForRestaurant` or admin check for the specific restaurant. An authenticated attacker who knows a restaurant UUID can POST table records into that tenant, corrupting floor/capacity data and potentially affecting booking availability.

## Recommendation

Before using the service-role client, validate `restaurantId` and require membership or admin membership for that exact restaurant. Prefer the cookie-bound/RLS client where possible, and verify any supplied `zoneId` belongs to the same restaurant.

## Revalidation

**Verdict:** fixed

The cross-tenant table creation scenario is blocked in the current code by a route-level restaurant authorization guard. The handler validates and authorizes the URL restaurantId with withRestaurantAuthorization before using getServiceSupabaseClient or insertTable. withRestaurantAuthorization requires the authenticated user's membership in that same restaurant and restricts the role to owner or manager, so an arbitrary logged-in user cannot target another tenant. The route also verifies supplied zoneId values against zones.restaurant_id for the same restaurant and rejects mismatches with 400. Service-role insertTable still bypasses RLS once called, but it only receives payloads after the guard and zone checks succeed. Commit 020a7389 introduced this fix, including the replacement of validateCsrfToken/getUser with withRestaurantAuthorization. The focused Vitest run passed the onboarding route containment and zone ownership regression tests.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)
