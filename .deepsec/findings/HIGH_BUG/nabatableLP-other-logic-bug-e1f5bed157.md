# [HIGH_BUG] Combination planner skips valid table combinations

**File:** [`server/capacity/selector.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/selector.ts#L596-L915) (lines 596, 600, 712, 728, 881, 883, 904, 915)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The planner sorts candidates by capacity descending, but when a candidate would exceed maxAllowedCapacity it breaks out of the loop. Because later candidates are smaller, they may still fit; breaking skips valid combinations and can incorrectly report no suitable plan. The seed loop also sorts seeds into a separate heuristic order but passes i + 1 as though that index belongs to sortedCandidates, which can skip candidates that should be considered with that seed.

## Recommendation

Replace the over-capacity break with continue for descending order, or change the iteration order so the pruning invariant is valid. Track each seed's index in sortedCandidates before calling dfs, and add regression tests where a larger candidate overflows but a later smaller candidate completes the party.

## Revalidation

**Verdict:** fixed

The combination planner now skips an over-capacity partner with `continue` instead of ending the loop, so smaller later candidates can still complete a valid merge. The heuristic seed loop also resolves each seed's actual index in the capacity-sorted candidate list before starting DFS, so seed ordering no longer reuses the heuristic loop index as if it were a sorted-candidate index.

Evidence: `pnpm exec vitest run tests/server/capacity/selector-merge-policy.test.ts` passed on 2026-05-16. The regression coverage verifies a large candidate that overflows does not prevent a smaller adjacent table from completing a valid merged plan.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-16)
