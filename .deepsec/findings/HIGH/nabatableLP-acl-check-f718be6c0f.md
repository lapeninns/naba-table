# [HIGH] Service-role replacement can be reached from onboarding without restaurant ownership

**File:** [`server/restaurants/servicePeriods.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/servicePeriods.ts#L150-L179) (lines 150, 153, 167, 179)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

updateServicePeriods accepts a caller-supplied restaurantId and defaults to the service-role Supabase client, then deletes and reinserts rows for that restaurant. The onboarding route src/app/api/onboarding/restaurant/[id]/service-periods/route.ts calls this helper with getServiceSupabaseClient() after only checking that some Supabase user is logged in and has a CSRF token; it never verifies requireMembershipForRestaurant or that the restaurant was created by that user. Any authenticated user who can obtain a CSRF token can PATCH an arbitrary restaurant id and replace or clear another tenant's service periods.

## Recommendation

Require per-restaurant membership or onboarding ownership before calling this helper. Prefer passing the cookie-bound client after authorization, or move the authorization check into a route/service wrapper that is impossible to bypass for request-originated restaurant IDs.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-23)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
