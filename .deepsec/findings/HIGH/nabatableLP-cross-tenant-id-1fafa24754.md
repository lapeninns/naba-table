# [HIGH] Authenticated users can overwrite another restaurant's service periods

**File:** [`src/app/onboarding/services/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/onboarding/services/page.tsx#L12) (lines 12)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Line 12 exposes the OnboardingWizard service-period step. That step sends the client-controlled state.restaurantId to /api/onboarding/restaurant/${state.restaurantId}/service-periods. The route handler only verifies that some Supabase user is logged in, then calls updateServicePeriods(restaurantId, ..., getServiceSupabaseClient()) without requireMembershipForRestaurant or requireAdminMembership. updateServicePeriods deletes and reinserts all service-period rows for the supplied restaurant_id, so any authenticated user with a CSRF token can replace another tenant's service windows if they know or obtain its UUID. Evidence: src/components/features/onboarding/OnboardingWizard.tsx:526-538, src/app/api/onboarding/restaurant/[id]/service-periods/route.ts:30-58, server/restaurants/servicePeriods.ts:167-195.

## Recommendation

Before any service-role write, call requireAdminMembership({ userId: user.id, restaurantId }) and return 403 on failure. Do not trust the onboarding client state as authorization input; use the membership check as the tenant boundary.

## Revalidation

**Verdict:** fixed

The page itself only exposes the service step of `OnboardingWizard`, and the wizard still sends `PATCH /api/onboarding/restaurant/${state.restaurantId}/service-periods`. The historical attack described in the finding was valid because `updateServicePeriods` deletes all existing service-period rows for the route restaurant id and reinserts the submitted list. Current `service-periods/route.ts` no longer relies on mere authentication; it imports `RESTAURANT_ADMIN_ROLES` and `withRestaurantAuthorization`, then returns the authorization failure response before any service-role write. The guard uses the server-resolved Supabase session user id, not client state, and checks a `restaurant_memberships` row for the exact route restaurant id with owner/manager role. CSRF is still required through the same guard, but CSRF possession alone no longer gives cross-tenant write capability. The `git show 020a7389` diff shows the vulnerable `validateCsrfToken` plus `getRouteHandlerSupabaseClient().auth.getUser()` block was removed and replaced by this membership check. The current code therefore patches the reported cross-tenant overwrite path.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
