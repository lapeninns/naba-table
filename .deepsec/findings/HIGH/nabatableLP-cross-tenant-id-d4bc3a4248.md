# [HIGH] Onboarding hours endpoint can overwrite any restaurant schedule through the service-role writer

**File:** [`server/restaurants/operatingHours.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/operatingHours.ts#L334-L389) (lines 334, 337, 378, 389)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

updateOperatingHours trusts the supplied restaurantId and, by default, uses the service-role Supabase client to delete and rewrite all rows for that restaurant. The onboarding route src/app/api/onboarding/restaurant/[id]/hours/route.ts authenticates any user and checks CSRF, but does not call requireMembershipForRestaurant before passing the path id and getServiceSupabaseClient() into this helper. Any authenticated user who knows another restaurant id can replace that restaurant's operating hours.

## Recommendation

Require per-restaurant membership or ownership in the onboarding hours route before calling this helper, and prefer passing a tenant/RLS-scoped client after authorization. Treat CSRF as request-origin protection only, not authorization.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
