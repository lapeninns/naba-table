# [BUG] Policy drift hash misses nested policy changes

**File:** [`server/capacity/table-assignment/assignment.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/assignment.ts#L407-L409) (lines 407, 409)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-policy-drift-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The policy drift check trusts hashPolicyVersion(policy), but the imported stableJson helper uses JSON.stringify with only top-level keys, causing nested services and turnBandsByOption contents to be serialized as empty objects. Changes to service durations, buffers, turn bands, or allowOverrun can therefore keep the same policyVersion and stale holds may confirm without PolicyDriftError.

## Recommendation

Replace the shared stableJson implementation with recursive key sorting or a deterministic stringify library, and test that nested service and turn-band changes alter hashPolicyVersion.

## Revalidation

**Verdict:** fixed

`server/capacity/v2/utils.ts` recursively sorts object keys before hashing, so nested service and turn-band policy changes alter `hashPolicyVersion`. The focused hash tests cover nested service-window and nested array-object changes plus key-order determinism.

Evidence: `pnpm exec vitest run tests/server/capacity/demand-profiles.test.ts tests/server/capacity/table-assignment-guards.test.ts tests/server/capacity/selector-merge-policy.test.ts tests/server/capacity-v2-utils.test.ts` passed on 2026-05-16. `pnpm exec prettier --check server/capacity/demand-profiles.ts server/capacity/selector.ts server/capacity/table-assignment/supabase.ts server/capacity/v2/utils.ts tests/server/capacity/demand-profiles.test.ts tests/server/capacity/table-assignment-guards.test.ts tests/server/capacity/selector-merge-policy.test.ts tests/server/capacity-v2-utils.test.ts` also passed.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
