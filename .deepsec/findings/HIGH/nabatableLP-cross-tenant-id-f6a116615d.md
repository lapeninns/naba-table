# [HIGH] Onboarding restaurant ID can be used for service-role cross-tenant writes

**File:** [`src/app/auth/signup/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/auth/signup/page.tsx#L12) (lines 12)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This signup page renders OnboardingWizard. The wizard sends state.restaurantId to /api/onboarding/restaurant/[id]/hours, service-periods, zones, and tables. Those handlers authenticate the user and validate CSRF, but then use the URL restaurant ID with getServiceSupabaseClient without verifying that the user owns or belongs to that restaurant. Because the wizard state is client-controlled and also persisted in sessionStorage, any authenticated user can supply another restaurant UUID and overwrite hours/service periods or create zones/tables for that tenant.

## Recommendation

For every /api/onboarding/restaurant/[id] mutating route, require owner/admin membership for the route restaurantId before using the service-role client. Prefer deriving the restaurant ID from server-side onboarding ownership state where possible.

## Revalidation

**Verdict:** fixed

The signup page renders `OnboardingWizard`, and the wizard still sends client-held `state.restaurantId` to onboarding restaurant endpoints. The backing endpoints have been hardened: hours, service-periods, zones, tables, and complete all call `withRestaurantAuthorization(req, restaurantId, { csrf: true, roles: RESTAURANT_ADMIN_ROLES })`. That guard validates the restaurant UUID, validates CSRF, resolves the session, and requires an owner/manager membership for that exact restaurant id. The service-role client is only obtained after authorization succeeds. The tables endpoint also verifies supplied zone ids belong to the same restaurant before inserting tables. The prior cross-tenant service-role write path was patched in `020a7389` and is covered by `tests/server/tenant-authorization-sprint2.test.ts`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)
