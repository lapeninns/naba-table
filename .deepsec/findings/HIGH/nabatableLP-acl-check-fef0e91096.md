# [HIGH] Global booking occasions can be changed by non-admin users

**File:** [`src/app/api/ops/occasions/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/occasions/route.ts#L33-L138) (lines 33, 34, 35, 36, 46, 47, 78, 85, 86, 116, 117, 128, 133, 138)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The ops occasions handler only verifies that a Supabase user exists, then uses the service-role client to read and upsert rows in the global booking_occasions table. There is no requireAdminMembership, requireMembershipForRestaurant, or platform-admin check in the handler. The proxy-level requireOpsAuth only proves some restaurant membership and permits host/server roles; the handler itself would also accept any signed-in user if middleware is missed. A low-privilege restaurant member can create or reactivate global occasion definitions that affect booking flows across tenants.

## Recommendation

Add a backend authorization guard before any service-role access. For tenant-owned occasions, move the route under a restaurant id and call requireAdminMembership for that restaurant; for truly global occasions, require an explicit platform-admin/service authorization. Keep service-role writes behind that guard and add CSRF validation for the mutating request.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-23)
