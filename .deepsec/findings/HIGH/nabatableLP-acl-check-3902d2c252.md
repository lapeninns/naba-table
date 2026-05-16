# [HIGH] Service-role service period mutation trusts caller-supplied restaurant ID

**File:** [`server/restaurants/servicePeriods.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/servicePeriods.ts#L150-L189) (lines 150, 153, 167, 170, 187, 189)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

`updateServicePeriods` accepts an arbitrary `restaurantId`, defaults to the service-role Supabase client, then deletes and reinserts all service periods for that ID. The ops settings route checks `requireAdminMembership`, but `src/app/api/onboarding/restaurant/[id]/service-periods/route.ts` only verifies CSRF and that some user is authenticated before calling `updateServicePeriods(restaurantId, ..., getServiceSupabaseClient())`; it never checks membership or ownership of the restaurant ID from the URL. Any authenticated user with a valid CSRF token can replace another restaurant's service periods if they know or can obtain its ID.

## Recommendation

Add a backend per-restaurant authorization check before every request-handler call, especially the onboarding PATCH route: require `requireAdminMembership` or verify the restaurant was created by the current onboarding user. Prefer passing a cookie/RLS-bound or tenant-scoped client after authorization, and avoid service-role defaults for request-reachable mutators.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-23)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
