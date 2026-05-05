# [HIGH_BUG] Auto-export can write stale Google data before drift checks run

**File:** [`src/app/api/ops/restaurants/[id]/dual-sync/auto-export/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/dual-sync/auto-export/route.ts#L66) (lines 66)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-drift-check-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This route calls runAutoExportForRestaurant(), which converts open outbound candidates into pinned export decisions and passes them to runPublish(). In the shared orchestrator, section-level batch export ports are invoked before the per-field pinned hash drift checks. Those batch ports perform real Google writes before CORE_DRIFT or GBP_DRIFT can reject stale candidates, so auto-export can overwrite newer Google-side data and then fail or skip audit rows after the external mutation has already happened.

## Recommendation

Move all per-field drift validation before any batch export port is called. Build the batch input only from decisions that already passed the pinned hash checks, and avoid external writes before operation rows exist.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)
