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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
