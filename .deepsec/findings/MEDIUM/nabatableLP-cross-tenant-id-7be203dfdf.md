# [MEDIUM] Table listing lacks an explicit restaurant membership check

**File:** [`src/app/api/ops/tables/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/tables/route.ts#L84-L95) (lines 84, 95)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

GET accepts restaurantId from the query string and passes it directly to listTablesWithSummary/listTables after only checking that a Supabase user exists. Unlike the timeline route and this file's POST handler, it never calls requireMembershipForRestaurant or checks restaurant_memberships for the requested restaurant. An authenticated ops user with any membership can probe another restaurantId; if table_inventory/zones RLS is absent or relaxed, this leaks another tenant's floor plan, capacity, zones, and table status summary.

## Recommendation

After resolving the authenticated user, call requireMembershipForRestaurant({ userId: user.id, restaurantId }) before any table or summary query. Keep RLS as defense in depth rather than the only route-level authorization.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
