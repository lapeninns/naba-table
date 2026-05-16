# [BUG] Pending export state can mask Google-side changes

**File:** [`server/dual-sync/state/compute.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/dual-sync/state/compute.ts#L68-L82) (lines 68, 74, 81, 82)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The state machine documents that pending*export should only overlay an effective core_dirty state, but the implementation also returns pending_export when only Google moved from lastInSyncHash and an open outbound candidate exists. It also preserves pending*_ and _\_failed states unconditionally while values diverge, without checking whether the relevant side has changed since the pending or failed decision. This can leave the ops UI showing a stale pending/failed state instead of gbp_dirty or conflict after Google changes, causing incorrect sync decisions.

## Recommendation

Compute the base state first, then apply pending_export only to core_dirty or the intended outbound states. Preserve pending/failed overlays only when the stored previous core/GBP hashes still match the current hashes for the side that the overlay represents.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)

**Verdict:** fixed

`computeFieldState` now takes previous core and GBP hashes and only preserves pending/failed overlays while the side chosen by that decision is unchanged. The open outbound candidate overlay is applied only to an effective core-side movement from a known last-in-sync baseline. `tests/server/dual-sync-state-compute.test.ts` covers stale outbound candidates, chosen-side movement, and both-sides-moved conflicts so pending/failed states no longer mask Google-side changes.
