# [HIGH] Authenticated users can overwrite another restaurant's service periods

**File:** [`src/app/api/onboarding/restaurant/[id]/service-periods/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/onboarding/restaurant/[id]/service-periods/route.ts#L25-L58) (lines 25, 30, 31, 41, 58)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH takes restaurantId directly from the URL params, verifies only CSRF and that some Supabase user is logged in, and then calls updateServicePeriods with getServiceSupabaseClient. There is no requireMembershipForRestaurant or requireAdminMembership check for the requested restaurant. The imported helper deletes all restaurant_service_periods for that restaurant_id and inserts the submitted replacements, and the service-role client bypasses RLS. Any authenticated user with a CSRF token can target another restaurant id and wipe or replace its service-period configuration.

## Recommendation

After getUser succeeds, require admin membership for restaurantId before any service-role write. Prefer the existing ops route pattern using requireAdminMembership, validate restaurantId as a UUID, and only use a service or tenant-scoped client after the membership check passes.

## Revalidation

**Verdict:** fixed

The current service-periods PATCH handler calls withRestaurantAuthorization with csrf: true and RESTAURANT_ADMIN_ROLES immediately after reading the route id. That guard validates the id format, enforces CSRF for PATCH, resolves the authenticated user, and verifies owner or manager membership for the exact restaurant id. If the user is merely authenticated but does not have the required membership, requireMembershipForRestaurant maps that condition to a 403 response. The service-role client and updateServicePeriods call happen only after the guard returns ok: true. updateServicePeriods still deletes and reinserts rows by restaurant_id, so the original bug would have been high impact, but the current authorization gate prevents the cross-tenant path. Commit 020a7389 added this guard and removed the prior direct session-only check. The focused tenant authorization test suite passed, including the assertion that onboarding routes do not build service clients when authorization fails.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
