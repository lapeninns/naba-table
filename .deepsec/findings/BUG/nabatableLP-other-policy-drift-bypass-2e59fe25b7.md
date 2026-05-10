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

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
