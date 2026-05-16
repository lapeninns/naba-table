# [HIGH_BUG] Batch profile exports execute before drift checks and audit row creation

**File:** [`server/dual-sync/publish/ports/profile-export.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/publish/ports/profile-export.ts#L148-L239) (lines 148, 211, 213, 237, 239)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-drift-check-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The batch export port performs real Google writes via syncRestaurantProfileWithGoogleBusinessProfile and patchRestaurantGoogleBusinessProfileLocationFields. In the default call path, runPublish invokes runBatchExportPorts before the per-field loop computes and checks pinnedCoreHash/pinnedGbpHash, and before createOperation creates audit rows. A stale publish request or auto-export candidate containing two profile export decisions can therefore mutate Google first, then later be reported as CORE_DRIFT or GBP_DRIFT with no matching operation row for the already-issued external write. This bypasses the intended stale-preview protection and can export unapproved newer Core values or overwrite Google changes that should have blocked the export.

## Recommendation

Move batch execution until after per-field drift validation and operation row creation, or pre-filter the batch to decisions that have passed the exact same pin checks before any remote call. Add regression coverage where a multi-field profile export has a stale pinned hash and assert that neither Google patch helper is invoked.

## Revalidation

**Verdict:** fixed

Profile batch exports now run only through `runBatchExportPorts` after `runPublish` has drift-checked the exact field pins and opened operation rows for the accepted write decisions. Stale profile export decisions are excluded before the batch port can call Google. Focused evidence: the orchestrator regression suite asserts stale multi-field export decisions do not call the batch or per-field export ports, while valid same-section exports go through the batch port only after operation rows exist.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)
