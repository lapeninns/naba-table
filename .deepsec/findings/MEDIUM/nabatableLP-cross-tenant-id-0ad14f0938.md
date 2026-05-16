# [MEDIUM] Table prefetch reaches an endpoint without explicit restaurant membership authorization

**File:** [`src/components/features/ops-shell/useOpsRoutePrefetch.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/ops-shell/useOpsRoutePrefetch.ts#L120) (lines 120)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Line 120 prefetches services.tableInventoryService.list(activeRestaurantId), which calls /api/ops/tables?restaurantId=... . The backing GET handler in src/app/api/ops/tables/route.ts authenticates the user but does not call requireMembershipForRestaurant for the supplied restaurantId before passing it to listTablesWithSummary. requireOpsAuth only proves the user belongs to some restaurant, so a direct request with another restaurant UUID can become a cross-tenant table inventory disclosure unless database RLS independently blocks it; this violates the repo's per-restaurant guard requirement.

## Recommendation

Add requireMembershipForRestaurant({ userId: user.id, restaurantId, client: supabase }) to the GET path before any table, zone, or summary queries, and add a regression test for a member of restaurant A requesting restaurant B.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)
