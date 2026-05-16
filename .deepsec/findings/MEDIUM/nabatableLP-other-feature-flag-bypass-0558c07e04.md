# [MEDIUM] Rejection analytics feature flag is enforced only client-side

**File:** [`src/contexts/ops-session.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/contexts/ops-session.tsx#L221-L238) (lines 221, 223, 225, 238)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-feature-flag-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The provider exposes `rejectionAnalytics` as a client feature flag and defaults it to false, and the `/app/rejections` page uses that client context to hide the dashboard. However, the backing API at `src/app/api/ops/dashboard/rejections/route.ts` only checks restaurant membership via `requireDashboardAccess` and returns analytics without checking `isOpsRejectionAnalyticsEnabled()`. A restaurant member can directly request `/api/ops/dashboard/rejections?restaurantId=<id>` while the feature is disabled and receive observability data such as booking IDs, skip reasons, and strategic rejection samples. Cross-tenant access is still mitigated by the membership check, so the impact is limited to bypassing the intended feature-off boundary.

## Recommendation

Enforce the same server-side feature flag in `src/app/api/ops/dashboard/rejections/route.ts` before authorization/data access, returning 404 or 403 when disabled. Keep the client-side flag only as a UI affordance.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-19)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-31)

## Remediation

**Verdict:** fixed

The rejection analytics dashboard API now checks `isOpsRejectionAnalyticsEnabled()` before query parsing, authorization, or data access and returns 404 while the feature is disabled.

**Verification:** `pnpm exec vitest run tests/server/deepsec-final-controls-source.test.ts`
