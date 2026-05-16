# [MEDIUM] Hold conflict enforcement fails open when strict conflicts flag is disabled

**File:** [`server/capacity/holds.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/holds.ts#L131-L747) (lines 131, 136, 251, 308, 639, 640, 743, 747)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

createTableHold configures the database hold-conflict session from isHoldStrictConflictsEnabled() and then inserts the hold without an internal conflict check. When that flag is false, the database-side strict conflict GUC is set false, and callers rely on a separate findHoldConflicts pre-check before insertion. Concurrent public booking/auto-assignment requests for the same table window can both observe no conflict and then both insert overlapping holds. The legacy conflict path also returns an empty conflict set on schema/FK cache errors, further compounding the fail-open behavior.

## Recommendation

Fail closed for hold conflicts: do not disable database conflict enforcement in request paths, make createTableHold perform an atomic database-enforced conflict check regardless of feature flag state, and treat strict-conflict setup or conflict-query failures as blocking errors rather than falling back to no conflicts.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-03)
