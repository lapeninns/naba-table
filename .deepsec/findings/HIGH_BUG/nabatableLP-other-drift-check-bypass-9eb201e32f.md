# [HIGH_BUG] Batch export ports mutate Google before drift validation and audit rows

**File:** [`server/dual-sync/publish/orchestrator.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/publish/orchestrator.ts#L184-L452) (lines 184, 196, 215, 425, 452)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-drift-check-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

runPublish invokes runBatchExportPorts before the per-decision loop computes beforeCoreHash/beforeGbpHash and enforces pinnedCoreHash/pinnedGbpHash. runBatchExportPorts then calls the concrete batch port with the unvalidated export decisions. The default batch ports perform real Google writes, so a stale multi-field export can mutate Google first and only afterward be rejected as CORE_DRIFT or GBP_DRIFT in the main loop. In that case no operation row is created for the drifted decision even though the external side effect already happened.

## Recommendation

Validate every decision, compute current field hashes, enforce pins, and create pending/running operation rows before invoking any batch export port. Pass only validated decisions into the batch path, and record failures through operation rows instead of precomputing side effects.

## Revalidation

**Verdict:** fixed

`runPublish` now performs decision validation and exact pin comparison before preparing any write, creates the pending operation rows for accepted write decisions, and only then calls `runBatchExportPorts` with the prepared export subset. Stale pins are returned as `CORE_DRIFT` or `GBP_DRIFT` without operation rows or provider port calls. Focused evidence: `tests/server/dual-sync-publish-orchestrator.test.ts` verifies stale batched exports do not call `applyExportBatchToGoogle` or `applyExportToGoogle`, and valid batched exports create operation rows before the batch port invocation.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)
