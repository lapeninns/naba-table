# [MEDIUM] Cross-tenant table inventory read through unguarded restaurantId

**File:** [`server/ops/tables.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/ops/tables.ts#L430-L473) (lines 430, 432, 439, 447, 469, 473)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The table listing helpers trust a caller-supplied restaurantId and only apply database filters such as .eq('restaurant_id', restaurantId). The user-reachable GET /api/ops/tables route authenticates a Supabase user, but unlike the timeline and operations-hub routes it does not call requireMembershipForRestaurant before passing the query-string restaurantId into listTablesWithSummary/listTables. requireOpsAuth middleware only proves the user belongs to some restaurant, not the requested restaurant. A staff user for restaurant A can therefore request restaurant B's UUID and, if database RLS does not independently block table_inventory/zones, receive B's table numbers, capacities, zones, status, notes, and capacity summary. I did not find table_inventory/zones RLS policy coverage in the checked migrations, so the route-level missing authorization is security-relevant.

## Recommendation

Add requireMembershipForRestaurant({ userId, restaurantId }) to GET /api/ops/tables before calling these helpers, matching /api/ops/tables/timeline and /api/ops/operations-hub. Keep tenant RLS policies for table_inventory and zones as defense in depth.

## Revalidation

**Verdict:** true-positive

The current GET /api/ops/tables route authenticates a Supabase user but does not call requireMembershipForRestaurant for the query-string restaurantId. It then passes that caller-controlled restaurantId into listTablesWithSummary or listTables, whose only tenant handling is .eq('restaurant_id', restaurantId). The proxy requireOpsAuth only proves the user belongs to some restaurant and does not authorize this specific restaurant id. The nearby timeline and operations-hub routes do perform requireMembershipForRestaurant, which confirms this GET route is the outlier. I checked the repo migrations and found mutation-focused RLS hardening for table_inventory and zones, but no in-repo tenant-scoped SELECT policy that would serve as a reliable mitigation for this endpoint. An authenticated staff user can therefore target another restaurantId and the route will return whatever table_inventory and zones rows the authenticated database policy exposes for that id, including table numbers, capacities, status, notes, zones, and summary data.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
