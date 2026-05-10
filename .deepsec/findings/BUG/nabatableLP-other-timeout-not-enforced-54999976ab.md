# [BUG] Inline modification timeout is only relabeled after completion

**File:** [`server/bookings/modification-flow.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/modification-flow.ts#L38-L74) (lines 38, 42, 58, 73, 74)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-timeout-not-enforced`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

attemptInlineModificationAssign() computes timeoutMs but then awaits run() directly. The timeout is only used to rename a completed NO_HOLD result to INLINE_TIMEOUT; it does not abort quoteTablesForBooking() or atomicConfirmAndTransition(), and no AbortSignal is passed. A slow planner/database operation can exceed the configured inline timeout and hold the request open.

## Recommendation

Use the same CancellableAutoAssign/AbortController pattern as the creation inline auto-assign flow, pass the signal into quote and confirm operations, and persist INLINE_TIMEOUT from the abort path.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-28)
