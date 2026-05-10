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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
