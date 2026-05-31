# [BUG] Manager table delete UI is enabled but the API denies managers

**File:** [`src/components/features/tables/TableInventoryClient.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/tables/TableInventoryClient.tsx#L405-L1116) (lines 405, 1109, 1116)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-role-mismatch`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The client enables table deletion for isRestaurantAdminRole(activeMembership.role), which includes owner and manager. The traced DELETE /api/ops/tables/[id] handler instead permits only roles named owner or admin; admin is not one of the defined restaurant roles, and manager is omitted. Managers will see an enabled destructive action that consistently fails with 403.

## Recommendation

Use the shared RESTAURANT_ADMIN_ROLES/isRestaurantAdminRole logic in the DELETE handler, or change the client gate if managers should not delete tables.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)
