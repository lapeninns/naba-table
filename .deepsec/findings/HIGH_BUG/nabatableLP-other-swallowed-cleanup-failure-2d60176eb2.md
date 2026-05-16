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

## Revalidation

**Verdict:** true-positive

`clearBookingTableAssignments` wraps the lookup, `unassign_tables_atomic` RPC, fallback delete, zone-lock update, and idempotency cleanup in one broad `try/catch`. On any error it logs a warning and returns `0`, so callers cannot distinguish “nothing to clear” from “cleanup failed.” Several lifecycle paths call it after the primary status transition has already been persisted, including public cancellation, ops no-show, ops check-out/status completion, and the auto-complete job. Those callers either ignore the return value or wrap it in another catch that cannot fire because the helper swallowed the error. A failed cleanup can therefore leave active table assignments or zone/idempotency state behind after the booking is cancelled, no-showed, or completed. That stale state can block future reservations or misrepresent capacity while the API still reports the lifecycle mutation as successful.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-03)
