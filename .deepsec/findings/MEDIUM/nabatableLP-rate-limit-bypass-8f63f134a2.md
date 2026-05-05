# [MEDIUM] Unthrottled quote endpoint can be abused to exhaust table holds

**File:** [`src/app/api/staff/auto/quote/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/staff/auto/quote/route.ts#L11-L114) (lines 11, 16, 17, 74, 80, 114)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `rate-limit-bypass`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The route has no consumeRateLimit call or active-hold quota before invoking quoteTables. Any authenticated restaurant member can repeatedly POST bookingId/zoneId/avoidTables combinations; successful calls create and return table holds. The underlying quote engine sets hold expiry from the booking window end plus holdTtlSeconds, so future-booking holds can remain active until after the reservation window. This allows an authenticated low-privilege or compromised staff account to degrade availability by filling capacity with quote holds.

## Recommendation

Add per-user, per-restaurant, and per-booking rate limits; cap active quote holds per booking/user; make quote hold creation idempotent where possible; and ensure temporary quote holds expire from creation time if they are not meant to reserve capacity until the booking ends.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-07)
