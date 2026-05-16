# [HIGH_BUG] Assignment cleanup failures are swallowed after lifecycle changes

**File:** [`server/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings.ts#L480-L551) (lines 480, 491, 514, 521, 535, 546, 551)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-swallowed-cleanup-failure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

clearBookingTableAssignments() catches every failure from lookup, atomic unassign RPC, fallback delete, zone-lock clearing, and idempotency cleanup, logs a warning, and returns 0. Callers such as cancellation, no-show, check-out, and auto-complete ignore the return value, so a booking can be marked cancelled/completed while table assignments remain active and continue blocking capacity.

## Recommendation

Let cleanup failures propagate or return a required structured failure that callers must handle. Prefer one transactional RPC for status transition plus assignment/zone/idempotency cleanup.

## Revalidation

**Verdict:** true-positive

This duplicate cleanup finding is still valid. The helper catches every failure internally and returns `0`, including failures in the assignment lookup, atomic unassign RPC, fallback delete, `assigned_zone_id` clearing, and idempotency cleanup. Lifecycle callers persist the booking transition first and then call the cleanup helper. Because the helper does not throw, those callers continue as if cleanup succeeded. I verified this pattern in cancellation, no-show, check-out/status completion, and auto-complete paths. The result is a booking status transition that releases no capacity when cleanup fails.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
