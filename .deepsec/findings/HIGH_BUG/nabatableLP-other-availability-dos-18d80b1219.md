# [HIGH_BUG] Quoted holds can last until the booking window ends

**File:** [`server/capacity/table-assignment/quote.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/quote.ts#L760-L770) (lines 760, 763, 770)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-availability-dos`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

quoteTablesForBooking derives holdExpiresAt from requestedWindowEndDate and then adds holdTtlSeconds. For a future booking, a quoted but unconfirmed hold can remain active until after the reservation window rather than for the configured short TTL. Because hold conflict checks treat unexpired holds as blockers, abandoned quotes or quote-only callers can block table capacity for hours or days.

## Recommendation

Base quote hold expiry on DateTime.now().plus({ seconds: holdTtlSeconds }) for temporary holds, and ensure callers that only need suggestions either use a side-effect-free quote path or release the hold when they do not confirm it.

## Revalidation

**Verdict:** fixed

`quoteTablesForBooking` now computes temporary quote hold expiry from `DateTime.now().toUTC().plus({ seconds: clampQuoteHoldTtlSeconds(...) })` instead of the requested reservation window end. `createTableHold` also no longer normalizes temporary holds forward to `endAt`, so future bookings keep the short quote TTL rather than blocking tables until the service window. Focused evidence: `pnpm exec vitest run tests/server/capacity/table-assignment-guards.test.ts tests/server/capacity/direct-assignment-atomic.test.ts` passed on 2026-05-16.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-16)
