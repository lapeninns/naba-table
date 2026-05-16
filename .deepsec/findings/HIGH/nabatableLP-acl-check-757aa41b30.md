# [HIGH] Authenticated users can update another restaurant's service periods

**File:** [`src/app/api/onboarding/restaurant/[id]/service-periods/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/onboarding/restaurant/[id]/service-periods/route.ts#L30-L58) (lines 30, 31, 41, 58)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The PATCH handler takes restaurantId directly from the URL, verifies only that a Supabase user exists, then calls updateServicePeriods with getServiceSupabaseClient. There is no requireMembershipForRestaurant or requireAdminMembership check tying the authenticated user to the restaurant. Because the service-role client bypasses RLS and updateServicePeriods deletes/reinserts rows by restaurant_id, any logged-in user with a CSRF token can replace service periods for any restaurant ID they know.

## Recommendation

Before calling updateServicePeriods, require admin membership for user.id and restaurantId, return 403 on MembershipAccessError, and prefer a tenant-scoped or RLS-aligned client after authorization.

## Revalidation

**Verdict:** fixed

The current code does not trust the URL restaurant id after checking only that a user exists. It passes the id into withRestaurantAuthorization with owner/manager roles and CSRF protection before validating or applying the payload. The guard ultimately queries restaurant_memberships with both user_id and restaurant_id, so a valid session for another tenant is insufficient. Unauthorized users receive the guard response, and the route returns before getServiceSupabaseClient or updateServicePeriods is reached. The service-period replacement helper remains service-role backed, but it is now invoked only after tenant admin authorization succeeds. Commit 020a7389 is the relevant fix, replacing validateCsrfToken plus getUser with the shared restaurant authorization guard. The focused regression tests passed for this containment behavior.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
