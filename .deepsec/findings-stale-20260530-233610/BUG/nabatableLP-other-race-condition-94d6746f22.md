# [BUG] Pending-admin notification dedupe can be bypassed by concurrent jobs

**File:** [`server/jobs/auto-assign.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/jobs/auto-assign.ts#L92-L111) (lines 92, 96, 108, 111)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-race-condition`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

maybeNotifyAdminPending tries to dedupe pending-admin emails by atomically setting details.pending_admin_notified_at only when it is null, but it sends the email even when the update returns no row. If two auto-assign jobs reach this path concurrently, the loser of the conditional update gets data === null, falls back to the stale booking object, and still calls sendBookingPendingAttentionEmail. The update also lacks a current-status predicate, so a stale pending booking can be notified after another worker has moved it to a terminal state.

## Recommendation

Only send the pending-admin email when the conditional update returns a row, and include a non-terminal status predicate in the update or re-read the booking immediately before sending.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-11)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-16)
