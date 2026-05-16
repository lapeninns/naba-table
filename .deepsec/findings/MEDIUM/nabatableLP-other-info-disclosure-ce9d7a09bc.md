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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-24)

**Verdict:** fixed

`src/app/api/bookings/route.ts` now maps both policy and legacy guest lookup rows through a guest-safe DTO before returning them. The DTO omits confirmation tokens, idempotency keys, client request ids, pending refs, details, and notes. Covered by `tests/server/public-bookings-route.test.ts`.
