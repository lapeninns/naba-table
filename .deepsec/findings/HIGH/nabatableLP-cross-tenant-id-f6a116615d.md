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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
