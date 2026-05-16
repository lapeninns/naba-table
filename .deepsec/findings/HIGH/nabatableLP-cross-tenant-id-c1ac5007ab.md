# [HIGH] Onboarding zone creation can write to any restaurant id

**File:** [`server/ops/zones.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/ops/zones.ts#L39-L47) (lines 39, 41, 47)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

createZone trusts input.restaurantId and inserts it directly as restaurant_id. The traced onboarding caller at src/app/api/onboarding/restaurant/[id]/zones/route.ts takes the restaurant id from the URL, only checks that a user is authenticated and has a CSRF token, then calls createZone with getServiceSupabaseClient(). Because the service-role client bypasses RLS and the route does not call requireMembershipForRestaurant or requireAdminMembership for that restaurant id, any authenticated user who knows a target restaurant UUID can create zones in another tenant.

## Recommendation

Before calling createZone from onboarding routes, verify the authenticated user owns or is an admin/member of the route restaurant id. Prefer requireAdminMembership for setup/configuration writes, or bind the onboarding restaurant to the creating user and enforce that relationship before using a service-role client.

## Revalidation

**Verdict:** fixed

The helper still trusts its input, but the traced onboarding route is no longer the auth-only service-role caller described in the finding. src/app/api/onboarding/restaurant/[id]/zones/route.ts now resolves the route restaurantId and calls withRestaurantAuthorization with csrf true and RESTAURANT_ADMIN_ROLES before calling createZone. That guard validates the session, validates the restaurant id shape, checks CSRF for the POST, and requires owner or manager membership for the same restaurant id. Only after authorization succeeds does the route obtain getServiceSupabaseClient and insert zones. Git history shows this was changed in 020a7389, replacing the previous validateCsrfToken plus auth.getUser-only flow. An authenticated user without admin membership in the target restaurant now fails before the service-role write.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-24)
