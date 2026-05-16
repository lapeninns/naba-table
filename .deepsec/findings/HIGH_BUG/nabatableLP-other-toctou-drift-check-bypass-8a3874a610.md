# [HIGH_BUG] Batch publish can mutate Google before stale pinned hashes are rejected

**File:** [`src/app/api/ops/restaurants/[id]/dual-sync/publish/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/dual-sync/publish/route.ts#L80) (lines 80)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-toctou-drift-check-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This handler passes user-provided decisions to runPublish. In the imported orchestrator, runBatchExportPorts executes before the per-decision pinnedCoreHash and pinnedGbpHash checks. For two or more export_to_google decisions in the same section, the concrete batch port can patch Google Business Profile first, and only afterward does the main loop detect CORE_DRIFT or GBP_DRIFT and mark the operation as failed. This defeats the advertised stale-view protection and can corrupt external restaurant data.

## Recommendation

Perform all per-field drift checks before invoking any export port, especially batch ports, and add tests proving stale pinned hashes prevent external writes for both single and batched publishes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)
