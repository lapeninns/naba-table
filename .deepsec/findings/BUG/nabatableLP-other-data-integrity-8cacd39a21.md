# [BUG] Booking rows can disagree with their linked customer rows

**File:** [`scripts/seed-bookings-week-final.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/seed-bookings-week-final.ts#L120-L157) (lines 120, 122, 126, 127, 150, 152, 156, 157)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-data-integrity`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

For each booking, the script creates the customer with one generated email/phone pair, then calls createBooking with newly generated email/phone values for the same name. Depending on Date.now timing, the booking.customer_email and booking.customer_phone can differ from the linked customers row, corrupting test data relationships and making customer lookups misleading.

## Recommendation

Generate name, email, and phone once per guest, store them in local variables, and use the same values for both customer and booking inserts.

## Revalidation

**Verdict:** fixed

`scripts/seed-bookings-week-final.ts` now generates each synthetic guest's email and phone once, uses those values when creating the linked customer row, and reuses the same values when inserting the booking row. The same script is now guarded by `assertStagingScriptSafety`, requires `CONFIRM_STAGING_BOOKING_SEED=true`, and requires explicit `RESTAURANT_ID`.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-21)
