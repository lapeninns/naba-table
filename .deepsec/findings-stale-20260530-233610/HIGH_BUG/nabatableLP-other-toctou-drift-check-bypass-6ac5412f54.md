# [HIGH_BUG] Batch auto-export can write to Google before pinned-hash drift checks

**File:** [`src/app/api/ops/restaurants/[id]/dual-sync/auto-export/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/dual-sync/auto-export/route.ts#L66) (lines 66)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-toctou-drift-check-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route reaches runPublish through runAutoExportForRestaurant. In the imported orchestrator, section-level batch export ports are invoked before the per-field pinnedCoreHash and pinnedGbpHash drift checks run. Concrete batch ports perform Google Business Profile writes. When auto-export has two or more open candidates in the same section, stale candidates that should be rejected for CORE_DRIFT or GBP_DRIFT can still mutate Google before the orchestrator records the drift failure.

## Recommendation

Move drift validation ahead of runBatchExportPorts, or pass only prevalidated export decisions into the batch port. Add a regression test where a stale pinned hash in a multi-decision batch causes no Google/core write.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)
