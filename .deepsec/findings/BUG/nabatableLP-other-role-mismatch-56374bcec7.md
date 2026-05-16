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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
