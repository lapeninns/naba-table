# [HIGH] Onboarding restaurant ID drives service-role writes without restaurant authorization

**File:** [`src/components/features/onboarding/OnboardingWizard.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/onboarding/OnboardingWizard.tsx#L417-L743) (lines 417, 424, 527, 534, 715, 728, 743)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The wizard uses client-controlled state.restaurantId in mutating onboarding calls for hours, service periods, zones, and tables. Tracing those endpoints shows they only verify that a Supabase user exists, then use getServiceSupabaseClient() to write data for the URL restaurant id without requireMembershipForRestaurant or requireAdminMembership. An authenticated user can tamper the persisted onboarding state or call the endpoints directly with a valid CSRF token and mutate another restaurant's operating hours, service periods, zones, or table inventory.

## Recommendation

Add per-restaurant authorization to every /api/onboarding/restaurant/[id] mutating handler before any service-role write. Use requireAdminMembership or requireMembershipForRestaurant against the URL restaurant id and authenticated user id, and keep the client restaurantId as convenience state only.

## Revalidation

**Verdict:** fixed

The wizard does use client-controlled `state.restaurantId` in mutating calls for hours, service periods, zones, and tables. The underlying helpers are impactful: operating hours and service periods delete and recreate rows for the supplied `restaurant_id`, while zones and tables insert rows using service-role access. In the current route handlers, that client-controlled id is not trusted directly because each handler first calls `withRestaurantAuthorization` with admin roles. The guard resolves the authenticated user from the Supabase session and calls `requireMembershipForRestaurant` for the same route restaurant id before allowing the request to continue. If the user lacks owner or manager membership, the handler returns the guard response and never reaches `getServiceSupabaseClient`. The tables handler further validates that supplied zone ids are from the route restaurant before inserting table inventory. The `020a7389` diff confirms this was a patch over the older code that only verified CSRF and some logged-in user. The current implementation fixes the cross-tenant service-role write condition.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)
