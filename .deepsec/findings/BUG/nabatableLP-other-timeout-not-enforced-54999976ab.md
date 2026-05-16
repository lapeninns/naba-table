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

## Revalidation

**Verdict:** fixed

This duplicate lower-severity finding is fixed by the same `server/bookings/modification-flow.ts` change as the HIGH_BUG copy: modification inline assignment now uses `CancellableAutoAssign`, passes the timeout `AbortSignal` into quote and confirm, and returns `INLINE_TIMEOUT` so fallback work can continue promptly.

Evidence: `pnpm exec vitest run tests/server/bookings-modification-flow.test.ts` passed on 2026-05-16. Scoped lint also passed with `pnpm exec eslint --max-warnings=0 server/bookings/modification-flow.ts tests/server/bookings-modification-flow.test.ts`.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-28)
