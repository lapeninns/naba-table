# [HIGH] Authenticated users can create tables for any restaurant

**File:** [`src/app/api/onboarding/restaurant/[id]/tables/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/onboarding/restaurant/[id]/tables/route.ts#L33-L65) (lines 33, 34, 44, 61, 65)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler takes restaurantId directly from the URL and only verifies that some Supabase user is logged in. It never calls requireMembershipForRestaurant or requireAdminMembership for that restaurant before switching to getServiceSupabaseClient and inserting rows with restaurant_id set to the supplied id. Because the service-role client bypasses RLS, any authenticated user who knows a restaurant id can POST arbitrary tables into another tenant's table_inventory, corrupting floor plans and capacity. Restaurant ids are not secret; the public restaurant detail API returns the id by slug.

## Recommendation

After authenticating the user, require membership or admin membership for the specific restaurantId before using the service client. Prefer an RLS-bound client where possible, or use a tenant-scoped service client only after the per-restaurant authorization check succeeds.

## Revalidation

**Verdict:** fixed

The current POST handler is no longer protected only by a generic authenticated-user check. It calls withRestaurantAuthorization(req, restaurantId, { csrf: true, roles: RESTAURANT_ADMIN_ROLES }) before parsing table input or constructing the service-role client. That shared guard enforces UUID shape, CSRF, a live Supabase session, and owner or manager membership for the route restaurant id. If the attacker knows another restaurant UUID but lacks membership for it, requireMembershipForRestaurant returns a 403 and insertTable is never called. The route also now requires every table to reference a zone and verifies the submitted zone ids belong to the same restaurant using the authorized Supabase client before inserting. Commit 020a7389 added these authorization and zone-ownership checks and removed the prior session-only path. The focused tenant authorization tests passed, including rejection of cross-restaurant zone ids and no service-client construction on failed authorization.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)
