# [HIGH] Non-admin restaurant members can mutate zone configuration

**File:** [`server/ops/zones.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/ops/zones.ts#L47-L85) (lines 47, 73, 85)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

createZone, updateZone, and deleteZone perform sensitive seating-configuration writes, while the traced /api/ops/zones callers only query restaurant_memberships and never enforce owner/manager roles before invoking these helpers. Because roles include host and server, a lower-privileged restaurant member can directly call the API to create, rename, deactivate, reorder, or delete zones for their restaurant.

## Recommendation

Replace the raw membership checks in the zone API callers with requireAdminMembership, or explicitly reject roles outside owner/manager before invoking these helpers. Also include restaurant_id in update/delete predicates where possible.

## Revalidation

**Verdict:** fixed

The current ops zone routes now enforce admin roles before mutation. src/app/api/ops/zones/route.ts checks membership for the requested restaurant and then rejects the request unless isRestaurantAdminRole returns true before calling createZone. src/app/api/ops/zones/[id]/route.ts first loads the zone, checks membership for zone.restaurant_id, and rejects non-admin roles before updateZone or deleteZone. Hosts and servers can still be members, but they now receive 403 for create, patch, and delete. The 20260505141000 migration also adds restrictive owner/manager RLS policies for zone mutations as defense in depth. The described raw membership-only mutation path is no longer present in current code.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-24)
