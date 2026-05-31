# [BUG] Confirmation notification dedupe is check-then-send and can race

**File:** [`server/bookings/confirmation-notifications.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/bookings/confirmation-notifications.ts#L34-L61) (lines 34, 43, 54, 61)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** medium • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The function checks recent email/SMS delivery logs before sending, then sends the email/SMS outside any lock or unique booking/template send intent. If two side-effect paths process the same confirmed booking at the same time, both can observe no recent delivery and both can send before either delivery log exists. The delivery log uniqueness is based on provider message identifiers, so it does not prevent duplicate confirmation messages for the same booking.

## Recommendation

Guard first-confirmation sends with an atomic database claim, such as a unique send-intent row keyed by booking ID and channel/template, or an advisory lock around the check and send scheduling step.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-10)
