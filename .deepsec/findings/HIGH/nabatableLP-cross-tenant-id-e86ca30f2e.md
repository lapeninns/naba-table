# [HIGH] Authenticated users can create tables for any restaurant

**File:** [`src/app/api/onboarding/restaurant/[id]/tables/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/onboarding/restaurant/[id]/tables/route.ts#L33-L65) (lines 33, 34, 44, 61, 65)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The handler takes restaurantId directly from the URL and only verifies that some Supabase user is logged in. It never calls requireMembershipForRestaurant or requireAdminMembership for that restaurant before switching to getServiceSupabaseClient and inserting rows with restaurant_id set to the supplied id. Because the service-role client bypasses RLS, any authenticated user who knows a restaurant id can POST arbitrary tables into another tenant's table_inventory, corrupting floor plans and capacity. Restaurant ids are not secret; the public restaurant detail API returns the id by slug.

## Recommendation

After authenticating the user, require membership or admin membership for the specific restaurantId before using the service client. Prefer an RLS-bound client where possible, or use a tenant-scoped service client only after the per-restaurant authorization check succeeds.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)
- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
