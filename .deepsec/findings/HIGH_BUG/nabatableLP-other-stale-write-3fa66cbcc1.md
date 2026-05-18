# [HIGH_BUG] Batch exports can write to Google before pinned drift checks run

**File:** [`src/components/features/restaurant-settings/dual-sync/DualSyncShell.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/restaurant-settings/dual-sync/DualSyncShell.tsx#L431-L276) (lines 431, 441, 266, 267, 276)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-stale-write`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

DualSyncShell sends pinned per-field hashes when publishing decisions, but tracing the publish path shows runPublish invokes section batch export ports before the per-field pinnedCoreHash/pinnedGbpHash checks. Bulk export selections from the shell can therefore mutate Google with stale data, and only afterwards does the server notice drift and skip recording the affected operation.

## Recommendation

Move batch port execution after server-side drift validation, or make the batch pre-pass filter out every decision whose pinned hashes do not match before any external write.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)
