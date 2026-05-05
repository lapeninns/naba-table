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

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-01)
