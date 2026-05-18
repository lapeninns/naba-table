# [HIGH] Table inventory API can be queried for arbitrary restaurant IDs

**File:** [`src/app/app/(app)/settings/restaurant/tables/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/settings/restaurant/tables/page.tsx#L12>) (lines 12)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This page renders the table settings client, which calls /api/ops/tables with a restaurantId. The GET handler for that API only checks that a Supabase user exists, then uses the query-string restaurantId to load table inventory, zones, and capacity summary. It does not call requireMembershipForRestaurant for the requested restaurant, while requireOpsAuth only proves membership in some restaurant. An authenticated user who knows another restaurant UUID can request that tenant's table/capacity data directly.

## Recommendation

In /api/ops/tables GET, call requireMembershipForRestaurant with the authenticated user ID and parsed restaurantId before any table, zone, or summary query. Add a regression test that a user from restaurant A receives 403 for restaurant B.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-01)
