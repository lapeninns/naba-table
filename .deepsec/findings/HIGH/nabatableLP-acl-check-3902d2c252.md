# [HIGH] Service-role service period mutation trusts caller-supplied restaurant ID

**File:** [`server/restaurants/servicePeriods.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/servicePeriods.ts#L150-L189) (lines 150, 153, 167, 170, 187, 189)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

`updateServicePeriods` accepts an arbitrary `restaurantId`, defaults to the service-role Supabase client, then deletes and reinserts all service periods for that ID. The ops settings route checks `requireAdminMembership`, but `src/app/api/onboarding/restaurant/[id]/service-periods/route.ts` only verifies CSRF and that some user is authenticated before calling `updateServicePeriods(restaurantId, ..., getServiceSupabaseClient())`; it never checks membership or ownership of the restaurant ID from the URL. Any authenticated user with a valid CSRF token can replace another restaurant's service periods if they know or can obtain its ID.

## Recommendation

Add a backend per-restaurant authorization check before every request-handler call, especially the onboarding PATCH route: require `requireAdminMembership` or verify the restaurant was created by the current onboarding user. Prefer passing a cookie/RLS-bound or tenant-scoped client after authorization, and avoid service-role defaults for request-reachable mutators.

## Revalidation

**Verdict:** fixed

The helper still accepts a restaurantId and defaults to the service client, but the cited onboarding route is now guarded. src/app/api/onboarding/restaurant/[id]/service-periods/route.ts calls withRestaurantAuthorization with csrf: true and RESTAURANT_ADMIN_ROLES before it parses the body or calls updateServicePeriods. The guard verifies the session and requires owner/manager membership for the exact restaurant id in the URL. An authenticated user with a CSRF token but no membership can no longer reach the service-role delete/reinsert call for another tenant. Git blame shows this route-level authorization was added in 020a7389. The cross-tenant onboarding exploit path is fixed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-23)
