# [HIGH] Zone update and delete allow non-admin restaurant members

**File:** [`src/app/api/ops/zones/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/zones/[id]/route.ts#L62-L147) (lines 62, 69, 84, 132, 139, 147)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

PATCH and DELETE only check that the authenticated user has any restaurant_memberships row for the zone's restaurant. The selected role is never checked and requireAdminMembership is not called before updateZone/deleteZone. Because roles include non-admin host/server members, those users can edit, deactivate, reorder, or delete zones for their restaurant, disrupting floor/table configuration and capacity behavior.

## Recommendation

Replace the raw membership lookup with requireAdminMembership, or explicitly require owner/manager via isRestaurantAdminRole before calling updateZone or deleteZone. Apply the same rule consistently to zone creation.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-27)
