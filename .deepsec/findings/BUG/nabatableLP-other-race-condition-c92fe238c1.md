# [BUG] Customer profile counters can lose updates under concurrent bookings or cancellations

**File:** [`server/customers.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/customers.ts#L231-L290) (lines 231, 245, 266, 279, 289, 290)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

recordBookingForCustomerProfile and recordCancellationForCustomerProfile read the current aggregate row, calculate new totals in application code, then upsert the result. Two concurrent bookings or cancellations for the same customer can read the same totals and both write the same incremented value, losing one update and corrupting customer profile aggregates.

## Recommendation

Move these aggregate updates into a database RPC or transaction that uses row locking or atomic INSERT ... ON CONFLICT DO UPDATE expressions that increment totals from the existing row.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-27)
