# [MEDIUM] Booking purge leaves SMS recipient PII behind

**File:** [`scripts/purge-restaurant-bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/purge-restaurant-bookings.ts#L309-L334) (lines 309, 319, 334)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-pii-retention`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The purge explicitly removes email_delivery_log rows but omits sms_delivery_log before deleting bookings. The sms_delivery_log schema stores recipient_phone and has booking_id with ON DELETE SET NULL, so after bookings are deleted those SMS rows retain phone-number PII while losing the booking_id link needed for a later cleanup by this script.

## Recommendation

Delete sms_delivery_log rows for the collected booking IDs before deleting bookings, or document intentional retention and cover it with a separate retention/anonymization policy.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
