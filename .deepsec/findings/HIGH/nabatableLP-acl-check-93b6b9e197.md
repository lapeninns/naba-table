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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
