# [MEDIUM] Public booking lookup returns full booking rows including sensitive fields

**File:** [`src/app/api/bookings/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/bookings/route.ts#L654-L1465) (lines 654, 683, 797, 821, 1377, 1461, 1465)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secrets-exposure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

GET /api/bookings accepts only email, phone, and restaurantId for the contact-query path, then returns the result of fetchBookingsForContact directly. That helper selects BOOKING_SELECT="\*", so the public response includes internal and sensitive booking columns such as confirmation_token, idempotency_key, client_request_id, details, customer email/phone, and notes. The POST response also returns finalBooking and the full bookings list directly. Anyone who knows or can guess a guest's contact details can enumerate active reservations and harvest these fields.

## Recommendation

Return an explicit public-safe booking DTO from guest lookup/create flows. Exclude confirmation_token, idempotency_key, details, internal assignment fields, and unnecessary PII. Make the guest lookup policy fail closed instead of falling back to the legacy full-row lookup when the RPC is missing or errors.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-24)
