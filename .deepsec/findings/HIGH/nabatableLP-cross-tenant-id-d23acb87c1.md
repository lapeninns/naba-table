# [HIGH] Service-role table creation can be reached without restaurant authorization

**File:** [`server/ops/tables.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/ops/tables.ts#L527-L533) (lines 527, 531, 533)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `cross-tenant-id`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

insertTable blindly inserts the supplied table_inventory payload with whatever Supabase client it is given. A current caller, src/app/api/onboarding/restaurant/[id]/tables/route.ts, takes restaurantId from the route parameter, checks only CSRF and that a Supabase user exists, then calls insertTable(getServiceSupabaseClient(), { restaurant_id: restaurantId, ... }). Because the service-role client bypasses RLS and there is no requireMembershipForRestaurant or requireAdminMembership check for that restaurant id, any authenticated user who knows a restaurant UUID can create table inventory rows for another tenant. CSRF does not mitigate same-user authorization abuse.

## Recommendation

Before any service-role insertTable call with a request-derived restaurant_id, require per-restaurant authorization, preferably requireAdminMembership for table setup. Validate that zone_id belongs to the same restaurant, and prefer a tenant-scoped or RLS-bound client for request paths. Consider adding a safer request-facing wrapper that takes userId and restaurantId and performs the membership check before inserting.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
