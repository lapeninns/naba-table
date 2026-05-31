# [MEDIUM] Repeated cancellation requests replay cancellation side effects

**File:** [`server/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/bookings.ts#L433-L456) (lines 433, 437, 445, 456)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `expensive-api-abuse`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

softCancelBooking() updates only rows whose status is not cancelled, but when no row is updated it fetches and returns the existing booking as if cancellation succeeded. Callers use the returned row to write audit/analytics records and enqueue cancellation email/SMS side effects. Repeating DELETE on an already-cancelled booking can therefore replay cancellation notifications and paid messaging work instead of becoming a no-op.

## Recommendation

Return an explicit changed/no-op result from softCancelBooking, or throw a typed already-cancelled error. Suppress audit and outbound cancellation side effects when no status transition occurred, and add rate limiting to public/session-recovery cancellation endpoints.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
