# [MEDIUM] Client-only rejection analytics feature gate is bypassable

**File:** [`src/contexts/ops-session.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/contexts/ops-session.tsx#L221-L225) (lines 221, 225)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-feature-flag-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

OpsSessionProvider exposes rejectionAnalytics as a client-side feature flag and the rejections page uses it to hide the dashboard when disabled. The backing APIs are still callable directly: src/app/api/ops/dashboard/rejections/route.ts enforces session and restaurant membership, then reads analytics with the service Supabase client, but does not check isOpsRejectionAnalyticsEnabled(); src/app/api/ops/settings/strategic-config/route.ts similarly exposes strategic config without the flag check. Unlike src/app/api/ops/strategies/simulate/route.ts, which hard-fails when the same feature flag is off, an authenticated restaurant member can request these endpoints directly while the UI says the feature is disabled and retrieve rejection analytics/strategic planner data for their restaurant.

## Recommendation

Treat the context flag as UX only and enforce the same server-side feature gate in every backing route for the feature, returning 404 or 403 before any data lookup when ops rejection analytics is disabled.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-31)

## Remediation

**Verdict:** fixed

The backing rejection analytics and strategic-config APIs both enforce `isOpsRejectionAnalyticsEnabled()` server-side before authentication, membership checks, or service data access.

**Verification:** `pnpm exec vitest run tests/server/deepsec-final-controls-source.test.ts`
