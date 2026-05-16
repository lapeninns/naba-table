# [HIGH] Authenticated users can create zones and tables for another restaurant

**File:** [`src/app/onboarding/tables/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/onboarding/tables/page.tsx#L12) (lines 12)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Line 12 exposes the OnboardingWizard tables step. That step sends the client-controlled state.restaurantId to /api/onboarding/restaurant/${state.restaurantId}/zones and /tables. Both route handlers only check that a user is authenticated, then use getServiceSupabaseClient() to insert rows for the supplied restaurant id without any per-restaurant membership or admin-role check. A logged-in attacker can create capacity data inside another tenant's restaurant by posting directly with a victim restaurant UUID. Evidence: src/components/features/onboarding/OnboardingWizard.tsx:714-748, src/app/api/onboarding/restaurant/[id]/zones/route.ts:27-66, src/app/api/onboarding/restaurant/[id]/tables/route.ts:33-79, server/ops/zones.ts:39-55, server/ops/tables.ts:527-543.

## Recommendation

Require requireAdminMembership({ userId: user.id, restaurantId }) before zone/table inserts. Also verify any supplied zoneId belongs to the same restaurant before inserting table_inventory rows.

## Revalidation

**Verdict:** fixed

The table step still constructs `/api/onboarding/restaurant/${state.restaurantId}/zones` and `/tables` from client state, so direct API tampering remains possible at the request layer. In current code, both onboarding zone and table handlers enforce `withRestaurantAuthorization` with `RESTAURANT_ADMIN_ROLES` before the service-role client is used. `withRestaurantAuthorization` calls `withOpsMutation` for CSRF and session validation, then `requireRestaurantMember`, which checks `restaurant_memberships` for the authenticated user id and the route restaurant id. The zone helper `createZone` inserts using the supplied restaurant id, but it is only reached after that admin membership check. The table route additionally verifies that every supplied zone id belongs to the same restaurant before calling `insertTable`. The `020a7389` security sprint diff shows the previous code only checked CSRF and a Supabase user, and the patch added both membership authorization and zone ownership validation. This makes the originally described cross-tenant insert path fixed in the current tree.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
