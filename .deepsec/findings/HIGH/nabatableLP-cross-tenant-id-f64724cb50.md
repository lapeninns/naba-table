# [HIGH] Onboarding restaurant update endpoints trust URL restaurant IDs with service-role writes

**File:** [`src/app/auth/signup/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/auth/signup/page.tsx#L11-L12) (lines 11, 12)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This signup page renders OnboardingWizard, which calls /api/onboarding/restaurant/[id]/hours, service-periods, zones, tables, and complete using the restaurantId held in client state. Those route handlers authenticate the user and validate CSRF, but they never verify that the user owns or belongs to the restaurant id from the URL before using getServiceSupabaseClient to mutate restaurant data. An authenticated user who knows another restaurant UUID can directly update or replace its operating hours/service periods and insert zones/tables.

## Recommendation

Before every /api/onboarding/restaurant/[id] mutation, validate the id and require owner/admin membership for that restaurant, or bind onboarding progress to a server-side restaurant created by the current user. Avoid service-role writes until authorization is proven.

## Revalidation

**Verdict:** fixed

The wizard still builds onboarding update URLs from client state, so the URL id remains attacker-controlled input. Current handlers no longer trust that id as authorization. Each `/api/onboarding/restaurant/[id]/*` mutation now calls `withRestaurantAuthorization` with `RESTAURANT_ADMIN_ROLES` and CSRF enabled before using service-role helpers. `withRestaurantAuthorization` requires membership for the same restaurant id passed in the route. The tables route also rejects zone ids that do not belong to the authorized restaurant. Therefore an authenticated user who knows another restaurant UUID should receive 403 before the service-role write path is reached.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
