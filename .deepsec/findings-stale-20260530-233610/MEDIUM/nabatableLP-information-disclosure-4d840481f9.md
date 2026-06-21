# [MEDIUM] Contact booking lookup returns full booking rows including internal tokens

**File:** [`server/bookings.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/bookings.ts#L98-L278) (lines 98, 254, 265, 267, 278)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `information-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

BOOKING_SELECT is '\*' and fetchBookingsForContact() returns raw BookingRecord rows. One shipped self-service DELETE caller returns this helper's bookings array directly in the HTTP response after cancellation. The bookings row includes internal and sensitive fields such as confirmation_token, confirmation_token_expires_at, confirmation_token_used_at, idempotency_key, client_request_id, auto_assign_idempotency_key, auth_user_id, details, and other operational state. A customer who can cancel one auth-bound booking can receive full rows for all active bookings matching the same contact, rather than a public-safe DTO.

## Recommendation

Replace '\*' with an explicit public column list for contact lookups, or return a DTO from fetchBookingsForContact. Ensure HTTP callers map results through the existing guest booking DTO and never expose confirmation tokens, idempotency keys, auth IDs, or internal details.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
