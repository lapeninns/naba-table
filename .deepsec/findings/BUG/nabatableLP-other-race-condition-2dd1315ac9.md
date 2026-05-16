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

**Verdict:** fixed

`recordBookingForCustomerProfile` and `recordCancellationForCustomerProfile` now call service-role-only database RPCs instead of reading the aggregate row and writing absolute totals from application code. Migration `supabase/migrations/20260516114919_atomic_customer_profile_aggregates.sql` adds `record_booking_for_customer_profile_atomic` and `record_cancellation_for_customer_profile_atomic`, both implemented as `INSERT ... ON CONFLICT (customer_id) DO UPDATE` statements that increment counters from `public.customer_profiles` inside the database write. Regression coverage in `tests/server/customers.test.ts` proves both helpers use the RPC path without touching `from(...)`, and asserts the migration retains the atomic increment expressions and service-role grants.
