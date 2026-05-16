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

## Revalidation

**Verdict:** true-positive

On the guest/root host, src/proxy.ts lets /api/bookings pass through without ops auth, so the contact-query GET path is public. The route validates email, phone, and restaurantId/default restaurant, applies only an IP-scoped rate limit, then calls fetchBookingsForContact when no session-recovery token is supplied. guestLookupPolicy defaults to false in lib/env.ts, and even when enabled the route deliberately falls back to the legacy helper if the RPC is missing or errors. fetchBookingsForContact first finds the matching customer and then selects BOOKING_SELECT, which is the literal '\*'. The bookings Row type includes confirmation_token, confirmation_token_expires_at, confirmation_token_used_at, client_request_id, idempotency_key, details, customer_email, customer_phone, notes, and assignment fields. The route returns { bookings, access } directly, with no DTO applied to the legacy lookup result. The POST part of the finding is partly stale because current POST uses toGuestBookingDTO and no longer returns a full bookings list in the body, but the unauthenticated GET lookup still exposes full active booking rows and is enough to make the finding exploitable.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
