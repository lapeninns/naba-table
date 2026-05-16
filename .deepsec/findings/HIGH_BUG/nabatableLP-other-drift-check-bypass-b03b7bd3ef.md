# [HIGH_BUG] Publish drift protection can be bypassed before Google writes

**File:** [`src/app/api/ops/restaurants/[id]/dual-sync/publish/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/dual-sync/publish/route.ts#L38-L80) (lines 38, 39, 43, 80)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-drift-check-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route accepts client-supplied publish decisions and calls runPublish() with batch export ports. The shared orchestrator invokes runBatchExportPorts() before the per-field pinnedCoreHash and pinnedGbpHash checks, and the batch ports perform real Google mutations. An admin client can submit multiple same-section export decisions with stale or wrong pinned hashes and the Google write can happen before the later drift check rejects the decision. The schema also defaults per-field pins to null, which disables the orchestrator's per-field drift check entirely when a client omits them.

## Recommendation

Require pinned hashes for publish decisions unless an explicit audited force-publish mode exists, enforce snapshot/per-field drift checks before any batch or per-field port call, and only then create operation rows and perform external writes.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)
