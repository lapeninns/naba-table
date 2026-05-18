# [BUG] Pending and failed states can mask new conflicts

**File:** [`server/dual-sync/state/compute.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/state/compute.ts#L68-L74) (lines 68, 69, 70, 71, 72, 73, 74)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-state-machine-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The state machine returns previous pending_import, pending_export, import_failed, or export_failed states unconditionally before evaluating whether Core and Google both moved from lastInSyncHash. For example, with previousState='pending_export', lastInSyncHash='old', coreHash='core-new', and gbpHash='gbp-new', the truth table says this is a conflict, but lines 68-74 return pending_export. This can leave the UI and persisted state showing a stale pending/failed state instead of a newly introduced conflict.

## Recommendation

Include previous core/GBP hashes or candidate baseline hashes in the computation and only retain pending/failed overlays when the relevant side has not moved; otherwise fall through to dirty/conflict classification.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)
