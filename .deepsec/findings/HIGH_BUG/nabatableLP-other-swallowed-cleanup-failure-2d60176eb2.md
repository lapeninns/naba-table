# [HIGH_BUG] Failed table-assignment cleanup is silently treated as success

**File:** [`server/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings.ts#L490-L551) (lines 490, 491, 514, 535, 546, 551)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-swallowed-cleanup-failure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

clearBookingTableAssignments() catches every error from the assignment lookup, atomic RPC, fallback delete, zone-lock update, and idempotency cleanup, logs a warning, and returns 0. Callers such as cancellation, check-out, no-show, and completion paths ignore the return value, so a booking can be cancelled or completed while its table assignments remain active. That leaves stale capacity state and can block future reservations without surfacing an API failure.

## Recommendation

Do not swallow cleanup failures for state transitions that require releasing capacity. Move the full release operation into a single database RPC/transaction that selects current assignments, unassigns them, clears zone/idempotency state, and returns or throws atomically. Make callers fail or retry when release fails.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-01)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)

**Verdict:** fixed

`clearBookingTableAssignments` no longer swallows lookup, atomic unassign, fallback delete, zone-lock clear, or assignment-idempotency cleanup failures. It throws read errors directly and uses `assertAssignmentCleanupSucceeded` for fallback delete, zone clear, and idempotency cleanup errors, so lifecycle callers can fail or retry instead of treating failed cleanup as success. Focused evidence: `tests/server/bookings/assignment-cleanup.test.ts` passed on 2026-05-16 and verifies failures in zone cleanup and fallback delete are surfaced as thrown errors.
