# [HIGH_BUG] Hash canonicalization drops nested policy and snapshot fields

**File:** [`server/capacity/v2/utils.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/v2/utils.ts#L5-L89) (lines 5, 7, 52, 54, 58, 87, 89)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

stableJson passes Object.keys(value).sort() as a JSON.stringify replacer array. That whitelist is applied at every nesting level, so nested object properties are omitted. For example, a VenuePolicy serializes services and turnBandsByOption as empty objects, so hashPolicyVersion does not change when service windows, buffers, or turn-band durations change. The same helper is used by computePayloadChecksum, so arrays of table, adjacency, and hold objects can collapse to [{}]. These hashes feed policy drift and manual assignment context validation, so stale holds or UI contexts may remain valid after operational policy or table state changes, leading to invalid table assignments or overbooking.

## Recommendation

Replace stableJson with a recursive canonical serializer that sorts keys at every object level while preserving arrays and primitive values. Add regression tests proving that nested changes to policy services, turn bands, table fields, adjacency edges, and holds all change their corresponding hashes.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
