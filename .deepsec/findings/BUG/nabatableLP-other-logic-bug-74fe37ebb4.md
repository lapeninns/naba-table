# [BUG] Combination planner prunes valid smaller-table candidates

**File:** [`server/capacity/selector.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/selector.ts#L600-L883) (lines 600, 881, 882, 883)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

enumerateCombinationPlans sorts candidates by descending capacity, but the DFS loop breaks when the current candidate would exceed maxAllowedCapacity. Because later candidates are smaller, they may still fit where the current larger table does not. This can incorrectly skip valid combinations and return no suitable table plan even when one exists.

## Recommendation

Replace the break with continue for over-capacity candidates, and add a regression test where a larger candidate exceeds the capacity cap but a later smaller candidate forms a valid combination.

## Revalidation

**Verdict:** fixed

`server/capacity/selector.ts` continues past over-capacity candidates while enumerating combinations, so smaller later candidates can still complete a valid plan. The selector regression covers a larger overflowing partner followed by a smaller fitting partner.

Evidence: `pnpm exec vitest run tests/server/capacity/demand-profiles.test.ts tests/server/capacity/table-assignment-guards.test.ts tests/server/capacity/selector-merge-policy.test.ts tests/server/capacity-v2-utils.test.ts` passed on 2026-05-16. `pnpm exec prettier --check server/capacity/demand-profiles.ts server/capacity/selector.ts server/capacity/table-assignment/supabase.ts server/capacity/v2/utils.ts tests/server/capacity/demand-profiles.test.ts tests/server/capacity/table-assignment-guards.test.ts tests/server/capacity/selector-merge-policy.test.ts tests/server/capacity-v2-utils.test.ts` also passed.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-16)
