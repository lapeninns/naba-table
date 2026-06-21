# [BUG] Non-adjacent manual holds store metadata the confirmer rejects

**File:** [`server/capacity/table-assignment/manual.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/manual.ts#L758-L1238) (lines 758, 767, 1238)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

createManualHold and instantTableAssignment write metadata.selection.snapshot as null when requireAdjacency is false. The confirmation path currently requires metadata.selection.snapshot unconditionally, so these valid manual holds fail later with HOLD_METADATA_INCOMPLETE instead of confirming.

## Recommendation

Either always store a minimal snapshot, or update confirmation metadata validation to treat a null snapshot as valid when requireAdjacency is false.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
