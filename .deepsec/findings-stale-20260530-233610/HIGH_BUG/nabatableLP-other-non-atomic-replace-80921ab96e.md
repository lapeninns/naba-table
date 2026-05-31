# [HIGH_BUG] Delete-then-insert service period replacement can permanently erase schedules

**File:** [`server/restaurants/servicePeriods.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/restaurants/servicePeriods.ts#L167-L187) (lines 167, 187)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-replace`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

updateServicePeriods deletes every service period for the restaurant before attempting the replacement insert. If the insert fails after the delete, for example due to duplicate supplied ids, a constraint error, or a transient database/network failure, the restaurant is left with no service periods. Concurrent replacement requests can also interleave because there is no transaction or compare-and-swap guard.

## Recommendation

Perform the replacement in a single database transaction or RPC that validates the full payload first, deletes and inserts atomically, and rolls back on any failure. Also reject duplicate period ids before touching persisted rows.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-23)
