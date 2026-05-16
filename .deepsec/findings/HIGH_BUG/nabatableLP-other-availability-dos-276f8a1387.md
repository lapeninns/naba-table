# [HIGH_BUG] Quoted table holds expire at reservation end instead of TTL

**File:** [`server/capacity/table-assignment/quote.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/capacity/table-assignment/quote.ts#L760-L770) (lines 760, 761, 763, 770)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-availability-dos`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

quoteTablesForBooking bases hold expiry on requestedWindowEndDate and then adds holdTtlSeconds. For future bookings, a 180-second quote hold therefore remains active until the reservation window ends plus 180 seconds. Abandoned or failed quotes can block table candidates for an entire future service, and the staff quote endpoint exposes this behavior to authenticated users.

## Recommendation

Compute expiresAt from DateTime.now().toUTC().plus({ seconds: holdTtlSeconds }), clamp the TTL server-side, and remove any shared hold normalization that forces expiresAt to be after endAt for temporary holds.

## Revalidation

**Verdict:** fixed

Quoted table holds now use a clamped temporary TTL from the current time, not the reservation end. The shared hold creation path preserves that short expiry and no longer pushes `expires_at` beyond `end_at` for future bookings. Focused tests cover both the quote expiry helper and the lower-level `createTableHold` normalization path: `pnpm exec vitest run tests/server/capacity/table-assignment-guards.test.ts tests/server/capacity/direct-assignment-atomic.test.ts` passed on 2026-05-16.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-16)
