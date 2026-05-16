# [HIGH_BUG] Inline modification timeout is only relabeled after completion

**File:** [`server/bookings/modification-flow.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/bookings/modification-flow.ts#L38-L74) (lines 38, 42, 58, 73, 74)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-timeout-not-enforced`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

attemptInlineModificationAssign() computes timeoutMs but then awaits run() directly. The timeout is only used to rename a completed NO_HOLD result to INLINE_TIMEOUT; it does not abort quoteTablesForBooking() or atomicConfirmAndTransition(), and no AbortSignal is passed. A slow planner/database operation can exceed the configured inline timeout and hold the request open.

## Recommendation

Use the same CancellableAutoAssign/AbortController pattern as the creation inline auto-assign flow, pass the signal into quote and confirm operations, and persist INLINE_TIMEOUT from the abort path.

## Revalidation

**Verdict:** true-positive

The code path matches the finding exactly: `timeoutMs` is calculated but never used to race or abort the inline assignment operation. The nested `run()` function is awaited directly, so slow `quoteTablesForBooking` or `atomicConfirmAndTransition` calls can run past the configured timeout. The only timeout-dependent branch executes after `run()` returns and only changes a completed `NO_HOLD` result to `INLINE_TIMEOUT`. No `AbortSignal` is passed despite the downstream table-assignment APIs supporting one. Because the booking has already been moved into pending state and table assignments have already been cleared before this call, the impact is more than inaccurate telemetry: the request can time out before fallback notification and scheduling logic executes. I would treat this duplicate timeout finding as `HIGH_BUG` rather than only `BUG`.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-28)
