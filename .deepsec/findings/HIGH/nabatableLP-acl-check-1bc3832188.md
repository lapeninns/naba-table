# [HIGH] Non-admin restaurant members can update or delete zones

**File:** [`src/app/api/ops/zones/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/zones/[id]/route.ts#L62-L147) (lines 62, 64, 69, 85, 132, 134, 139, 147)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

PATCH and DELETE authenticate the user and verify membership for the zone's restaurant, but the returned role is never checked. Any member role, including host or server, can pass the membership check and then update zone name/order/active state or delete an unused zone. Zones drive table capacity and assignment behavior, so this is a role-based privilege escalation within a tenant.

## Recommendation

Replace the manual membership query with requireAdminMembership, or explicitly reject roles outside owner/manager before calling updateZone or deleteZone.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-27)
