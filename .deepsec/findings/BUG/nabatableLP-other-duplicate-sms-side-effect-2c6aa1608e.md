# [BUG] First-confirmation SMS is not deduplicated

**File:** [`server/bookings/confirmation-notifications.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/confirmation-notifications.ts#L31-L47) (lines 31, 42, 47)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-duplicate-sms-side-effect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The helper checks the email delivery log before sending confirmation email, but it always calls sendGuestBookingConfirmationSms() whenever allowSms is true. A second invocation after a successful confirmation SMS will send another paid SMS because the SMS delivery log is written only after sending and is never consulted here.

## Recommendation

Add a recent SMS delivery check keyed by bookingId, smsType='booking_confirmation', recipient phone, and a suitable window before sending. Alternatively enforce provider-level idempotency for confirmation SMS sends.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)
