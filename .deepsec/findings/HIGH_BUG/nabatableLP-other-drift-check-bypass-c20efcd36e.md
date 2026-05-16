# [HIGH_BUG] Batch exports run before pinned-hash drift checks and audit rows

**File:** [`server/dual-sync/publish/orchestrator.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/publish/orchestrator.ts#L181-L452) (lines 181, 184, 215, 230, 452)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-drift-check-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

runPublish calls runBatchExportPorts before the per-decision validation and pinned hash checks. runBatchExportPorts then invokes the concrete batch export port, and the batch ports perform real Google writes. A stale batch export can therefore mutate Google before the later CORE_DRIFT/GBP_DRIFT checks reject the same decisions. In that case no operation rows are created for the drifted decisions, so the endpoint can report drift failure while the external side effect has already happened without audit.

## Recommendation

Validate all decisions, verify fieldKey/sectionKey consistency, enforce pinned hashes, deduplicate field keys, and create pending operation rows before invoking any per-field or batch port. Pass only drift-checked decisions into the batch path.

## Revalidation

**Verdict:** fixed

`runBatchExportPorts` is now fed from the orchestrator's prepared write list, not raw client decisions. Each prepared item has already passed required-pin validation, field/section validation, current-hash drift checks, capability/policy gates, and operation-row creation. Focused evidence: `tests/server/dual-sync-publish-orchestrator.test.ts` covers stale batched export rejection before ports and confirms valid batched exports create operation rows before the batch port call.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)
