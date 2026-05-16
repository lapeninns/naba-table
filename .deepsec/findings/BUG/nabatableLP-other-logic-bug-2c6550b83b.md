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

## Revalidation

**Verdict:** fixed

The non-adjacent manual hold shape remains `snapshot: null`, and confirmation metadata validation now accepts that shape when `requireAdjacency: false`. Adjacency-required holds still fail fast if their snapshot is missing.

Evidence: `pnpm exec vitest run tests/server/capacity/demand-profiles.test.ts tests/server/capacity/table-assignment-guards.test.ts tests/server/capacity/selector-merge-policy.test.ts tests/server/capacity-v2-utils.test.ts` passed on 2026-05-16. `pnpm exec prettier --check server/capacity/demand-profiles.ts server/capacity/selector.ts server/capacity/table-assignment/supabase.ts server/capacity/v2/utils.ts tests/server/capacity/demand-profiles.test.ts tests/server/capacity/table-assignment-guards.test.ts tests/server/capacity/selector-merge-policy.test.ts tests/server/capacity-v2-utils.test.ts` also passed.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
