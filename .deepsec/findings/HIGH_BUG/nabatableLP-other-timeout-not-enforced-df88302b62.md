# [HIGH_BUG] Inline modification timeout is not actually enforced

**File:** [`server/bookings/modification-flow.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/modification-flow.ts#L38-L142) (lines 38, 41, 72, 74, 92, 94, 142)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-timeout-not-enforced`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

attemptInlineModificationAssign calculates timeoutMs, but run() is awaited directly with no AbortController or Promise.race. The timeout is only used after run() returns to relabel a NO_HOLD result. Since beginBookingModificationFlow has already set the booking to pending and cleared table assignments before this call, a slow or hung planner can hold the request until platform timeout and leave the booking partially modified without timely email or background scheduling.

## Recommendation

Wrap the quote/confirm operation in the same cancellable timeout pattern used by inline-auto-assign, pass an AbortSignal into quoteTablesForBooking and atomicConfirmAndTransition, and ensure fallback notification/background scheduling happens even when the inline attempt times out.

## Revalidation

**Verdict:** true-positive

The current `attemptInlineModificationAssign` computes `timeoutMs`, but then awaits `run()` directly. There is no `AbortController`, no `Promise.race`, and no `CancellableAutoAssign` wrapper in this modification flow. `quoteTablesForBooking` and `atomicConfirmAndTransition` both support an `AbortSignal`, but this caller does not pass one. The timeout is only used after `run()` completes to relabel a completed `NO_HOLD` result as `INLINE_TIMEOUT` when the duration exceeded the threshold. Since `beginBookingModificationFlow` updates the booking to pending and clears assignments before this inline attempt, a slow planner or database operation can hold the request until an outer platform timeout and prevent the fallback email/background scheduling from running promptly. The creation flow in `server/bookings/inline-auto-assign.ts` shows the intended cancellable timeout pattern, confirming this path is missing the enforcement.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-28)
