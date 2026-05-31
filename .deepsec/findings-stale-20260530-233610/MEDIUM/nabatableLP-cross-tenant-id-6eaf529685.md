# [MEDIUM] Table inventory list uses caller-supplied restaurantId without a per-restaurant access check

**File:** [`src/services/ops/tables.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/tables.ts#L226-L242) (lines 226, 227, 242)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The table list service sends the caller-provided `restaurantId` directly to `/api/ops/tables`. The traced GET handler authenticates the user but does not call `requireMembershipForRestaurant` before querying `listTablesWithSummary` or `listTables`; the proxy-level `requireOpsAuth` only proves the user has some restaurant membership. An authenticated staff user for one restaurant can request another restaurant ID and retrieve its table inventory, notes, zones, and capacity summary.

## Recommendation

In `src/app/api/ops/tables/route.ts`, call `requireMembershipForRestaurant({ userId: user.id, restaurantId })` before any table or summary query, and add a cross-tenant regression test.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
