# [HIGH] Non-admin restaurant members can update or delete zones

**File:** [`src/app/api/ops/zones/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/zones/[id]/route.ts#L62-L147) (lines 62, 64, 69, 85, 132, 134, 139, 147)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH and DELETE authenticate the user and verify membership for the zone's restaurant, but the returned role is never checked. Any member role, including host or server, can pass the membership check and then update zone name/order/active state or delete an unused zone. Zones drive table capacity and assignment behavior, so this is a role-based privilege escalation within a tenant.

## Recommendation

Replace the manual membership query with requireAdminMembership, or explicitly reject roles outside owner/manager before calling updateZone or deleteZone.

## Revalidation

**Verdict:** fixed

The current PATCH and DELETE handlers both authenticate the user and load the membership for the zone's restaurant. After confirming a membership exists, each handler now calls isRestaurantAdminRole(membership.role) and returns 403 for non-admin roles. Since isRestaurantAdminRole only accepts owner and manager, host and server users cannot reach updateZone or deleteZone through these routes. The 20260505141000 RLS hardening migration also adds restrictive owner/manager write policies for zones. The described route-level privilege escalation is therefore patched in the current tree.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-27)
