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

## Revalidation

**Verdict:** fixed

The client computes canDeleteTables with isRestaurantAdminRole(activeMembership.role), which includes owner and manager. I traced DELETE /api/ops/tables/[id] and the current handler also uses isRestaurantAdminRole(membership.role), rather than the older owner/admin string check described in the finding. The role helper in lib/owner/auth/roles.ts defines RESTAURANT_ADMIN_ROLES as owner and manager, and there is no admin restaurant role. Therefore managers who pass the client gate now also pass the backend role gate, assuming they are members of the table's restaurant. The delete route still returns 403 for host/server roles and 409 for future assignments, but not for managers solely because of a role-name mismatch. Git blame shows the delete role check was corrected in commit 020a7389.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-08)
