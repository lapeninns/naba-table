# [MEDIUM] Rejection analytics flag is only enforced in client navigation

**File:** [`src/components/features/ops-shell/navigation.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/ops-shell/navigation.tsx#L107) (lines 107)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `security-behind-flag`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The Rejections nav item is hidden with requiresFeatureFlag at line 107, but the backing API at src/app/api/ops/dashboard/rejections/route.ts does not check isOpsRejectionAnalyticsEnabled() or env.featureFlags.opsRejectionAnalytics before returning analytics after a membership check. An authenticated restaurant member can bypass the disabled UI by calling /api/ops/dashboard/rejections?restaurantId=<their-restaurant-id> directly and retrieve rejection/strategy telemetry even when the feature is configured off. Client-side hiding is not a backend authorization control.

## Recommendation

Enforce the rejectionAnalytics feature flag in the API route before loading data, returning 404 or 403 when disabled, and keep the navigation/page checks as UX only.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)
