# [HIGH_BUG] Operating-hours update can erase the schedule if the replacement insert fails

**File:** [`src/app/api/ops/restaurants/[id]/hours/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/hours/route.ts#L217) (lines 217)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-non-atomic-replace`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The PUT handler calls updateOperatingHours(), whose implementation deletes all restaurant_operating_hours rows for the restaurant and then inserts the replacement rows outside a transaction. If the insert fails after the delete, for example due to a constraint error, duplicate/colliding override id, or transient database failure, the restaurant is left with no operating-hours rows.

## Recommendation

Move the replace operation into a database RPC/transaction that validates, deletes, and inserts atomically. Alternatively upsert by stable keys and delete stale rows only after the replacement rows are committed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
