# [HIGH] Any authenticated user can create tables for arbitrary restaurants

**File:** [`src/app/api/onboarding/restaurant/[id]/tables/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/onboarding/restaurant/[id]/tables/route.ts#L33-L65) (lines 33, 34, 44, 61, 64, 65)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The handler only checks that a Supabase user exists, then trusts the URL `id` as `restaurantId` and inserts rows with `getServiceSupabaseClient()`, which bypasses RLS. There is no `requireMembershipForRestaurant` or admin check for the specific restaurant. An authenticated attacker who knows a restaurant UUID can POST table records into that tenant, corrupting floor/capacity data and potentially affecting booking availability.

## Recommendation

Before using the service-role client, validate `restaurantId` and require membership or admin membership for that exact restaurant. Prefer the cookie-bound/RLS client where possible, and verify any supplied `zoneId` belongs to the same restaurant.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)
- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
