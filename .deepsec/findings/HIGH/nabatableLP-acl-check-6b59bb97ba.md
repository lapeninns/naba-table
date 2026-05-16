# [HIGH] Onboarding restaurant ID drives service-role writes without restaurant authorization

**File:** [`src/components/features/onboarding/OnboardingWizard.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/onboarding/OnboardingWizard.tsx#L417-L743) (lines 417, 424, 527, 534, 715, 728, 743)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The wizard uses client-controlled state.restaurantId in mutating onboarding calls for hours, service periods, zones, and tables. Tracing those endpoints shows they only verify that a Supabase user exists, then use getServiceSupabaseClient() to write data for the URL restaurant id without requireMembershipForRestaurant or requireAdminMembership. An authenticated user can tamper the persisted onboarding state or call the endpoints directly with a valid CSRF token and mutate another restaurant's operating hours, service periods, zones, or table inventory.

## Recommendation

Add per-restaurant authorization to every /api/onboarding/restaurant/[id] mutating handler before any service-role write. Use requireAdminMembership or requireMembershipForRestaurant against the URL restaurant id and authenticated user id, and keep the client restaurantId as convenience state only.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
