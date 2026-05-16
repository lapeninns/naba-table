# [BUG] In-sync recomputes do not persist a last-known-good baseline

**File:** [`server/dual-sync/state/recompute.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/state/recompute.ts#L158-L183) (lines 158, 159, 165, 175, 181, 182, 183)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-state-machine-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

recomputeAllStates writes coreValueHash and gbpValueHash for every evaluated field, but it never passes lastInSyncHash or lastInSyncAt when nextState is in_sync. Because upsertFieldState only updates fields that are explicitly provided, a field first observed as in_sync can keep lastInSyncHash=null. A later one-sided change is then classified as drifted instead of core_dirty or gbp_dirty, degrading sync decisions and automation.

## Recommendation

When nextState is in_sync, pass lastInSyncHash: coreHash (or gbpHash, they are equal) and lastInSyncAt to upsertFieldState so future recomputes have a real baseline.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-03)

**Verdict:** fixed

`recomputeAllStates` now passes `lastInSyncHash` and `lastInSyncAt` whenever the computed next state is `in_sync`, using the current core/GBP hash as the baseline. `tests/server/dual-sync-recompute.test.ts` asserts that a fresh in-sync observation persists the last-known-good hash so later one-sided changes classify as dirty rather than drifted.
