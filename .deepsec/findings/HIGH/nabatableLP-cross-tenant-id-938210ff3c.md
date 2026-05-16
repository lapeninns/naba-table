# [HIGH] Authenticated users can create zones and tables for another restaurant

**File:** [`src/app/onboarding/tables/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/onboarding/tables/page.tsx#L12) (lines 12)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Line 12 exposes the OnboardingWizard tables step. That step sends the client-controlled state.restaurantId to /api/onboarding/restaurant/${state.restaurantId}/zones and /tables. Both route handlers only check that a user is authenticated, then use getServiceSupabaseClient() to insert rows for the supplied restaurant id without any per-restaurant membership or admin-role check. A logged-in attacker can create capacity data inside another tenant's restaurant by posting directly with a victim restaurant UUID. Evidence: src/components/features/onboarding/OnboardingWizard.tsx:714-748, src/app/api/onboarding/restaurant/[id]/zones/route.ts:27-66, src/app/api/onboarding/restaurant/[id]/tables/route.ts:33-79, server/ops/zones.ts:39-55, server/ops/tables.ts:527-543.

## Recommendation

Require requireAdminMembership({ userId: user.id, restaurantId }) before zone/table inserts. Also verify any supplied zoneId belongs to the same restaurant before inserting table_inventory rows.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
