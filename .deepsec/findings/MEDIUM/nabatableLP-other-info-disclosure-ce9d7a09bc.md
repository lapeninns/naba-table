# [MEDIUM] Guest booking lookup returns raw booking records including secret fields

**File:** [`src/app/api/bookings/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/bookings/route.ts#L797-L821) (lines 797, 821)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-info-disclosure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The unauthenticated contact lookup calls fetchBookingsForContact and returns the resulting bookings directly. That helper selects BOOKING_SELECT = "\*", so callers who know a guest email and phone receive full booking rows, including PII, notes/details, idempotency data, and confirmation_token fields. This is broader than a guest-safe lookup response and enables PII scraping from a public endpoint.

## Recommendation

Return a dedicated sanitized DTO for guest lookup. Exclude confirmation_token, idempotency keys, internal details, and unnecessary PII; require a signed recovery token or OTP for sensitive details.

## Revalidation

**Verdict:** true-positive

The unauthenticated contact lookup is reachable on GET /api/bookings without me=1 and without a session-recovery token. Its current customer lookup requires both normalized email and normalized phone to match the same customer, which narrows the attacker prerequisite, but it is still not a session, OTP, or signed-token proof of control. Once a customer is found, fetchBookingsForContact selects '\*' from bookings for active statuses. The response returns those rows directly rather than mapping them through a public-safe DTO. Because the bookings row contains confirmation_token, idempotency_key, client_request_id, details, notes, and full contact PII, a caller who knows a guest's email and phone can harvest fields that should not be exposed from a public lookup. The IP rate limit reduces bulk abuse but does not mitigate disclosure for known contacts.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
