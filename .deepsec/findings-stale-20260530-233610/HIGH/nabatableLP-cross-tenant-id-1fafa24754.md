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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
