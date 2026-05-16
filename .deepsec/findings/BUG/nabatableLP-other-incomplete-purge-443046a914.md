# [BUG] Booking purge leaves SMS delivery PII behind

**File:** [`scripts/purge-restaurant-bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/purge-restaurant-bookings.ts#L292-L315) (lines 292, 302, 315)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-incomplete-purge`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The explicit delete list removes email_delivery_log rows but does not remove sms_delivery_log rows before deleting bookings. The schema stores recipient_phone and booking_id in sms_delivery_log, with booking_id using ON DELETE SET NULL; after this script succeeds, SMS delivery rows for purged bookings remain associated with the restaurant and retain phone numbers while losing the booking link. That is an incomplete purge of booking-related PII.

## Recommendation

Delete sms_delivery_log rows for the collected booking IDs before deleting bookings, or explicitly document that SMS audit logs are intentionally retained and ensure they are covered by a separate retention/anonymization policy.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

**Verdict:** fixed

`scripts/purge-restaurant-bookings.ts` includes `sms_delivery_log` in the transactional child-delete list keyed by `booking_id`, and the transaction processes child delete specs before deleting rows from `bookings`. SMS delivery rows tied to purged bookings are therefore removed before the booking delete can sever the booking link.

Evidence: `pnpm exec vitest run tests/scripts/destructive-script-atomicity.test.ts` passed on 2026-05-16. `pnpm exec prettier --check tests/scripts/destructive-script-atomicity.test.ts scripts/purge-restaurant-bookings.ts` also passed.
