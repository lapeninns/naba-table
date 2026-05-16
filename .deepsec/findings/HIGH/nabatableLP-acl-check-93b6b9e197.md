# [HIGH] Non-admin restaurant members can mutate table inventory and zones

**File:** [`src/components/features/tables/TableInventoryClient.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/tables/TableInventoryClient.tsx#L405-L943) (lines 405, 613, 622, 647, 663, 695, 721, 759, 764, 907, 943)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The table inventory UI exposes create/update table actions and create/update/delete zone actions to any member with an activeRestaurantId; only table deletion is UI-gated. Tracing the backing APIs confirms POST /api/ops/tables, PATCH /api/ops/tables/[id], and the zone create/update/delete routes check only for any membership row, not owner/manager admin role. A host/server member can therefore alter capacity-affecting settings such as tables, zones, active flags, and service inventory, which should be restricted like other restaurant settings mutations.

## Recommendation

Enforce requireAdminMembership server-side for table and zone inventory mutations, and hide/disable the client controls based on the same owner/manager role. If some lower-role actions are intended, split them into narrow endpoints with explicit role rules.

## Revalidation

**Verdict:** fixed

The client still exposes add/edit table and zone controls more broadly than ideal, with only table deletion visibly gated by isRestaurantAdminRole. However, the backing mutation APIs now enforce the admin role server-side. POST /api/ops/tables reads the restaurant membership and rejects non-admin roles with Insufficient permissions for table management. PATCH and DELETE /api/ops/tables/[id] fetch the table, resolve its restaurant, require a matching membership, and then call isRestaurantAdminRole before updating or deleting. POST /api/ops/zones and PATCH/DELETE /api/ops/zones/[id] perform the same owner-or-manager role check before mutating zones. The current residual issue is UX noise for non-admins, not an exploitable ACL bypass, because host/server members receive 403 responses from the mutation routes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-08)
