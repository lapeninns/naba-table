# [HIGH_BUG] Batched profile exports can mutate Google before drift checks run

**File:** [`server/dual-sync/publish/ports/profile-export.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/publish/ports/profile-export.ts#L211-L239) (lines 211, 237, 239)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-drift-check-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The batch export port immediately calls Google mutation helpers for name/contactPhone and address/businessDescription batches. Its caller, runBatchExportPorts, invokes batch ports before the orchestrator performs per-decision pinned hash drift checks. A stale publish request containing multiple profile export decisions can therefore push current unreviewed Core values to Google even though the same decisions should later fail CORE_DRIFT or GBP_DRIFT.

## Recommendation

Run per-field drift validation before invoking any batch port, and pass only validated decisions into the batch. Prefer creating operation rows before external side effects so failed drift cannot mutate Google silently.

## Revalidation

**Verdict:** fixed

The profile batch port is no longer reachable with unvalidated decisions in the current publish path. `runPublish` validates required pins, checks current Core and Google field hashes, and opens operation rows before passing prepared export decisions into `runBatchExportPorts`; profile batch writes therefore run only after the drift/audit gate. Focused evidence: the orchestrator stale-pin and 2+ same-section batch tests assert stale decisions do not call the batch/per-field ports and valid batches create operations before `applyExportBatchToGoogle`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)
