# [HIGH] Client-controlled restaurantId reaches onboarding service-role mutations without membership checks

**File:** [`src/components/features/onboarding/OnboardingWizard.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/onboarding/OnboardingWizard.tsx#L424-L897) (lines 424, 534, 728, 743, 897)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The wizard sends state.restaurantId into the onboarding hours, service-periods, zones, tables, and complete endpoints. Tracing those route handlers shows they only verify that a Supabase user exists, then use the route id directly; the hours/service-periods/zones/tables handlers use getServiceSupabaseClient(), so RLS is bypassed. An authenticated attacker can call these endpoints directly or tamper the persisted onboarding state to use another restaurant UUID, then alter operating hours/service periods or create zones/tables for that restaurant. Public restaurant detail APIs expose restaurant ids, so target ids are discoverable.

## Recommendation

In every /api/onboarding/restaurant/[id] handler, require requireAdminMembership or at least requireMembershipForRestaurant for the route restaurantId before any service-role call. Treat the client state as untrusted and reject ids the user does not own/administer.

## Revalidation

**Verdict:** fixed

I read `OnboardingWizard.tsx` fully; it still sends `state.restaurantId` to the onboarding hours, service-periods, zones, tables, and complete endpoints. That state is persisted in sessionStorage and is client-controlled, so the client side cannot be trusted as an authorization source. Current route handlers for all five endpoints call `withRestaurantAuthorization` with `csrf: true` and `roles: RESTAURANT_ADMIN_ROLES` before any service-role mutation or completion response. The guard validates UUID format, CSRF, Supabase session, and an owner/manager membership for the exact path restaurant id. The service-role calls in `updateOperatingHours`, `updateServicePeriods`, `createZone`, and `insertTable` still bypass RLS, but they now occur only after the route-level tenant check succeeds. The tables route also verifies zone ownership against the same route restaurant id. `git show 020a7389` shows the vulnerable session-only code was replaced with these authorization checks. Therefore the finding describes a real historical bug, but the current code has patched the exploitable server-side path.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-09)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)
