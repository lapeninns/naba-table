# [BUG] Manual holds without adjacency snapshots are rejected before confirmation

**File:** [`server/capacity/table-assignment/assignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/assignment.ts#L300-L459) (lines 300, 314, 459)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

confirmHoldAssignment unconditionally calls findMissingHoldMetadataFields() and throws HOLD_METADATA_INCOMPLETE when metadata.selection.snapshot is missing. Later in the same function the code explicitly expects snapshot validation to be skipped when adjacency was not required, but that branch is unreachable for holds whose snapshot is null. Manual hold creation stores snapshot: null when requireAdjacency is false, so valid single-table or non-adjacent manual holds can fail confirmation before the intended skip logic runs.

## Recommendation

Update hold metadata validation to require snapshot fields only when metadata.requireAdjacency is true. Add a regression test covering confirmation of a requireAdjacency=false manual hold.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
