# [BUG] Non-adjacent manual holds are created in a shape the confirmer rejects

**File:** [`server/capacity/table-assignment/manual.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/manual.ts#L723-L1238) (lines 723, 758, 767, 1195, 1229, 1238)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

createManualHold and instantTableAssignment intentionally write metadata.selection.snapshot as null when requireAdjacency is false. The confirmation path currently treats a missing snapshot as incomplete metadata before it checks requireAdjacency, so these holds can be created successfully but then fail confirmation with HOLD_METADATA_INCOMPLETE.

## Recommendation

Keep the requireAdjacency=false metadata shape, but align confirmation validation so snapshot is optional for non-adjacent holds. Cover both manual and instant paths in tests.

## Revalidation

**Verdict:** fixed

`createManualHold` and `instantTableAssignment` can keep writing `snapshot: null` for `requireAdjacency: false` holds because the shared confirmation metadata validator now only requires snapshots for adjacency-required metadata. The guard tests cover the non-adjacent shape and the adjacency-required rejection.

Evidence: `pnpm exec vitest run tests/server/capacity/demand-profiles.test.ts tests/server/capacity/table-assignment-guards.test.ts tests/server/capacity/selector-merge-policy.test.ts tests/server/capacity-v2-utils.test.ts` passed on 2026-05-16. `pnpm exec prettier --check server/capacity/demand-profiles.ts server/capacity/selector.ts server/capacity/table-assignment/supabase.ts server/capacity/v2/utils.ts tests/server/capacity/demand-profiles.test.ts tests/server/capacity/table-assignment-guards.test.ts tests/server/capacity/selector-merge-policy.test.ts tests/server/capacity-v2-utils.test.ts` also passed.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
