# [BUG] Managers see table delete enabled but backend rejects them

**File:** [`src/components/features/tables/TableInventoryClient.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/tables/TableInventoryClient.tsx#L405-L1109) (lines 405, 1109)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-role-mismatch`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The client enables table deletion for isRestaurantAdminRole(activeMembership.role), which includes owner and manager. The traced DELETE /api/ops/tables/[id] handler checks membership.role against ["owner", "admin"], but the app roles are owner, manager, host, and server. As a result, managers get an enabled destructive action that consistently fails server-side.

## Recommendation

Align the API role check with the shared role helper or RESTAURANT_ADMIN_ROLES, and keep the client and server using the same role source.

## Revalidation

**Verdict:** fixed

This is the same role-mismatch path as the prior bug report, and the current code no longer contains the problematic owner/admin allowlist. TableInventoryClient enables delete for isRestaurantAdminRole, and the DELETE route now uses the same shared isRestaurantAdminRole helper on the server. Because isRestaurantAdminRole is backed by RESTAURANT_ADMIN_ROLES = [owner, manager], managers are allowed by both client and server. The route still validates membership against the table's restaurant and checks future booking assignments before deletion. A manager can still receive a 409 if the table has future assignments, but that is a data-integrity check rather than the reported role mismatch. The current code path is aligned and the bug is fixed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-08)
