# [HIGH] Any authenticated user can create zones for arbitrary restaurants

**File:** [`src/app/api/onboarding/restaurant/[id]/zones/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/onboarding/restaurant/[id]/zones/route.ts#L27-L59) (lines 27, 28, 38, 55, 58, 59)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler authenticates only the user session, then takes `restaurantId` directly from the route params and calls `createZone()` with a service-role Supabase client. No backend authorization verifies that the user owns or belongs to that restaurant. An authenticated attacker can create zones under another tenant and alter their table organization/capacity model.

## Recommendation

Require `requireMembershipForRestaurant` or `requireAdminMembership` for the route `restaurantId` before creating zones. Avoid service-role writes unless the tenant authorization check has already succeeded.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2025-12-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
