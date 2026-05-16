# [MEDIUM] Reservation existence oracle before authorization

**File:** [`src/app/api/reservations/[id]/confirmation/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/reservations/[id]/confirmation/route.ts#L40-L95) (lines 40, 46, 54, 58, 89, 95)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler performs a service-role booking lookup using the URL id before resolving authentication or validating a recovery token. A missing booking returns 404, while an existing booking with no valid caller identity reaches the later auth path and returns 401/403/token-specific errors. Because the lookup uses the service-role client, this behavior can distinguish existing reservation IDs across tenants before any authorization decision.

## Recommendation

Resolve the caller state first. Reject unauthenticated requests and invalid recovery tokens before the service-role booking lookup, and use a uniform response for missing versus unauthorized reservations where possible. Also validate the id format and consider rate limiting this PDF endpoint.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-13)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)

**Verdict:** fixed

`src/app/api/reservations/[id]/confirmation/route.ts` now validates caller identity or the recovery token before service-role booking lookup, validates the id format, and returns `Reservation not found` for missing or mismatched bookings. Covered by `tests/server/reservation-confirmation-route-security.test.ts`.
