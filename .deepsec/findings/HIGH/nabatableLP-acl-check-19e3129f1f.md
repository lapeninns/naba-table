# [HIGH] Zone update and delete allow non-admin restaurant members

**File:** [`src/app/api/ops/zones/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/zones/[id]/route.ts#L62-L147) (lines 62, 69, 84, 132, 139, 147)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH and DELETE only check that the authenticated user has any restaurant_memberships row for the zone's restaurant. The selected role is never checked and requireAdminMembership is not called before updateZone/deleteZone. Because roles include non-admin host/server members, those users can edit, deactivate, reorder, or delete zones for their restaurant, disrupting floor/table configuration and capacity behavior.

## Recommendation

Replace the raw membership lookup with requireAdminMembership, or explicitly require owner/manager via isRestaurantAdminRole before calling updateZone or deleteZone. Apply the same rule consistently to zone creation.

## Revalidation

**Verdict:** fixed

This duplicate ACL finding no longer matches the current handler behavior. PATCH checks the caller's membership role and rejects it unless isRestaurantAdminRole returns true before calling updateZone. DELETE performs the same role check before calling deleteZone. The shared role helper maps admin status to owner or manager, not merely to any restaurant membership. Non-admin staff can still authenticate to ops generally through requireOpsAuth, but they cannot mutate zones through this endpoint. The direct Supabase write path is also narrowed by the restrictive owner/manager zones policies in the current migrations.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-27)
