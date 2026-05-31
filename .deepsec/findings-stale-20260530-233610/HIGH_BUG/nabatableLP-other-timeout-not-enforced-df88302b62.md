# [HIGH_BUG] Inline modification timeout is not actually enforced

**File:** [`server/bookings/modification-flow.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/modification-flow.ts#L38-L142) (lines 38, 41, 72, 74, 92, 94, 142)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-timeout-not-enforced`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

attemptInlineModificationAssign calculates timeoutMs, but run() is awaited directly with no AbortController or Promise.race. The timeout is only used after run() returns to relabel a NO_HOLD result. Since beginBookingModificationFlow has already set the booking to pending and cleared table assignments before this call, a slow or hung planner can hold the request until platform timeout and leave the booking partially modified without timely email or background scheduling.

## Recommendation

Wrap the quote/confirm operation in the same cancellable timeout pattern used by inline-auto-assign, pass an AbortSignal into quoteTablesForBooking and atomicConfirmAndTransition, and ensure fallback notification/background scheduling happens even when the inline attempt times out.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-28)
