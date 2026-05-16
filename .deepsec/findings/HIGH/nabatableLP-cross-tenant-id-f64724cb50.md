# [HIGH] Onboarding restaurant update endpoints trust URL restaurant IDs with service-role writes

**File:** [`src/app/auth/signup/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/auth/signup/page.tsx#L11-L12) (lines 11, 12)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This signup page renders OnboardingWizard, which calls /api/onboarding/restaurant/[id]/hours, service-periods, zones, tables, and complete using the restaurantId held in client state. Those route handlers authenticate the user and validate CSRF, but they never verify that the user owns or belongs to the restaurant id from the URL before using getServiceSupabaseClient to mutate restaurant data. An authenticated user who knows another restaurant UUID can directly update or replace its operating hours/service periods and insert zones/tables.

## Recommendation

Before every /api/onboarding/restaurant/[id] mutation, validate the id and require owner/admin membership for that restaurant, or bind onboarding progress to a server-side restaurant created by the current user. Avoid service-role writes until authorization is proven.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
