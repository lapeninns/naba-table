# [HIGH_BUG] Stable JSON hashing drops nested object content

**File:** [`server/capacity/v2/utils.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/v2/utils.ts#L5-L89) (lines 5, 7, 52, 54, 87, 89)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

stableJson() calls JSON.stringify(value, Object.keys(value as object).sort()). That replacer array is a whitelist applied at every object depth, not a recursive key sorter. For VenuePolicy, hashPolicyVersion() keeps only top-level keys such as timezone/serviceOrder/services and serializes nested services and turnBandsByOption as empty objects, so materially different service windows or turn-band policies can produce the same policyVersion. For arrays of objects, Object.keys(array) is just array indexes, so object element properties are also dropped. These hashes are used for policy drift/versioning around holds and assignment context, so policy/table/adjacency changes can fail to invalidate stale assignment state.

## Recommendation

Replace stableJson with a recursive canonical serializer that deeply sorts object keys while preserving all nested properties and array contents. Add regression tests showing that changing nested service windows, turn bands, table fields, and adjacency entries changes the resulting hash.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
