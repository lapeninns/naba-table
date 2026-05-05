# [HIGH] Any restaurant member can modify table inventory

**File:** [`src/app/api/ops/tables/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/tables/[id]/route.ts#L96-L223) (lines 96, 103, 151, 199, 223)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

PATCH only checks that the authenticated user has some membership in the table's restaurant, then allows updates to sensitive table inventory fields including capacity, min/max party size, zoneId, active, status, position, notes, and maintenance allocation. Lower-privileged roles such as host/server can directly call this endpoint and alter capacity or mark tables out of service, even though table inventory is restaurant settings data and should be owner/manager controlled.

## Recommendation

Use requireAdminMembership or requireMembershipForRestaurant with RESTAURANT_ADMIN_ROLES before applying inventory configuration changes. If hosts/servers need status-only operations, split those into a separate endpoint with a narrow schema and explicit role policy.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
