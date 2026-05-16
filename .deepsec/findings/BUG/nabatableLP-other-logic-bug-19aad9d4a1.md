# [BUG] Manual holds without adjacency snapshots are rejected at confirmation

**File:** [`server/capacity/table-assignment/assignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/assignment.ts#L300-L314) (lines 300, 314)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

confirmHoldAssignment calls findMissingHoldMetadataFields and rejects missing metadata before it reads metadata.requireAdjacency. Manual hold creation intentionally stores selection.snapshot as null when requireAdjacency is false, so those holds can be created successfully but later fail confirmation with HOLD_METADATA_INCOMPLETE. This breaks valid non-adjacent manual assignment flows.

## Recommendation

Allow selection.snapshot to be absent when metadata.requireAdjacency is false, or move snapshot validation after parsing holdMetadata and gate it on requireAdjacency. Add a regression test for confirming a manual hold with requireAdjacency=false.

## Revalidation

**Verdict:** fixed

`findMissingHoldMetadataFields` now treats `metadata.selection.snapshot` as required only when hold metadata does not explicitly set `requireAdjacency: false`. Non-adjacent manual holds can therefore reach confirmation without failing early as incomplete metadata, while adjacency-required holds still require a snapshot.

Evidence: `pnpm exec vitest run tests/server/capacity/demand-profiles.test.ts tests/server/capacity/table-assignment-guards.test.ts tests/server/capacity/selector-merge-policy.test.ts tests/server/capacity-v2-utils.test.ts` passed on 2026-05-16. `pnpm exec prettier --check server/capacity/demand-profiles.ts server/capacity/selector.ts server/capacity/table-assignment/supabase.ts server/capacity/v2/utils.ts tests/server/capacity/demand-profiles.test.ts tests/server/capacity/table-assignment-guards.test.ts tests/server/capacity/selector-merge-policy.test.ts tests/server/capacity-v2-utils.test.ts` also passed.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
