# [HIGH] Onboarding hours can overwrite another restaurant's configuration

**File:** [`src/app/onboarding/hours/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/onboarding/hours/page.tsx#L12) (lines 12)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This page renders OnboardingWizard at step 3. The imported HoursStep sends PATCH requests to `/api/onboarding/restaurant/${state.restaurantId}/hours`, where `restaurantId` comes from client-controlled onboarding state/sessionStorage. The backing route only validates CSRF and checks that some Supabase user exists, then calls `updateOperatingHours(restaurantId, ..., getServiceSupabaseClient())` without `requireMembershipForRestaurant` or `requireAdminMembership`. Because the service-role client bypasses RLS, any authenticated user who obtains a restaurant UUID can replace that restaurant's operating hours. The same wizard flow later reaches service-period, zone, and table onboarding endpoints with the same missing per-restaurant authorization pattern.

## Recommendation

Before any `/api/onboarding/restaurant/[id]/*` mutation uses a service-role client, verify that the authenticated user is an owner/manager for that exact restaurant with `requireAdminMembership` or an equivalent onboarding ownership check. Treat client-held onboarding state as untrusted.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
