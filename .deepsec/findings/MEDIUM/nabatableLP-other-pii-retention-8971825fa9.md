# [MEDIUM] SMS delivery PII is not purged with bookings

**File:** [`scripts/purge-restaurant-bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/purge-restaurant-bookings.ts#L292-L315) (lines 292, 302, 315)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-pii-retention`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The purge script explicitly deletes booking-linked email delivery rows before deleting bookings, but omits sms_delivery_log from the deletion list. sms_delivery_log.booking_id uses ON DELETE SET NULL and stores recipient_phone, so once bookings are deleted those SMS rows remain associated with the restaurant but can no longer be found by booking_id on a later rerun. This leaves booking-related phone-number PII behind after an operator believes the restaurant's bookings were purged.

## Recommendation

Add sms_delivery_log to the pre-booking deletion list, using booking_id, and keep it before the final bookings delete so rows are removed before ON DELETE SET NULL severs the booking link.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
