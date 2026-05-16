# [HIGH_BUG] Timed-out inline auto-assign can still mutate booking state

**File:** [`src/services/inline-auto-assign.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/inline-auto-assign.ts#L150-L377) (lines 150, 175, 309, 377)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-timeout-race`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

runInlineAutoAssign launches planner and confirmation work inside CancellableAutoAssign.runWithTimeout. The timeout path records INLINE_TIMEOUT, but the already-started async operation is not made authoritative-cancelled in this function. If downstream work continues or a DB transaction completes after the timeout wins the race, this code can still call atomicConfirmAndTransition and then persist a success auto_assign_last_result. Callers make email and retry decisions based on runInlineAutoAssign returning null or an updated booking, so a slow path can be treated as pending by the API and then confirm/assign tables afterward in the background.

## Recommendation

Make timeout cancellation authoritative. Track a timedOut flag and check signal.aborted or that flag before creating holds, confirming, reloading, or persisting success. Ensure downstream hold and confirmation helpers accept and honor AbortSignal, and re-read the booking before returning if a DB transaction may have committed after timeout.

## Revalidation

**Verdict:** fixed

`runInlineAutoAssign` now tracks an authoritative timeout flag, checks that flag and `signal.aborted` before hold handling, confirmation, reload, and success persistence, and defers success `auto_assign_last_result` persistence until after `runWithTimeout` has returned without timing out. The timeout path still persists `INLINE_TIMEOUT`, but a timed-out operation no longer returns a booking or writes a success result afterward.

Evidence: `pnpm exec vitest run tests/server/inline-auto-assign.test.ts` passed on 2026-05-16. The focused regression forces the timeout path, verifies the quote received an `AbortSignal`, verifies `atomicConfirmAndTransition` is not called after timeout, and verifies no success result is persisted. The combined focused command `pnpm exec vitest run tests/server/ops-bookings-create-route.test.ts tests/server/bookings-modification-flow.test.ts tests/server/inline-auto-assign.test.ts` passed, and targeted ESLint passed for the changed files.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-01)
