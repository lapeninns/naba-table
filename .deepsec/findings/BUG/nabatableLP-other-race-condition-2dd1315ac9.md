# [BUG] Customer profile aggregate counters can lose updates under concurrency

**File:** [`server/customers.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/customers.ts#L231-L290) (lines 231, 245, 246, 251, 266, 279, 289, 290)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

recordBookingForCustomerProfile and recordCancellationForCustomerProfile read the current customer_profiles row, compute absolute counter values in application code, then upsert those values. Concurrent bookings or cancellations for the same customer can both read the same totals and overwrite each other, losing increments for total_bookings, total_covers, total_cancellations, last_booking_at, and marketing opt-in timestamps. The source booking records remain protected by their own writes, but the persisted customer profile aggregate can become incorrect.

## Recommendation

Move these aggregate updates into a single database RPC or SQL upsert that increments from the existing row atomically, e.g. ON CONFLICT DO UPDATE SET total_bookings = customer_profiles.total_bookings + 1, total_covers = customer_profiles.total_covers + excluded_delta, and total_cancellations = customer_profiles.total_cancellations + 1.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-27)
