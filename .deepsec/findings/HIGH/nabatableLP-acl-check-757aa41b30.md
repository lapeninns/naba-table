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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
