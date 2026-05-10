# [BUG] Receipt token flow is out of sync with current recovery-token API

**File:** [`src/app/guest/bookings/[bookingId]/receipt/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/guest/bookings/[bookingId]/receipt/page.tsx#L18-L107) (lines 18, 41, 42, 91, 101, 107)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-logic-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The receipt page claims to allow access with either an authenticated session or a token, but it only reads the legacy `token` query parameter and forwards it to `/api/bookings/:id`. The current booking detail API rejects any `token` query parameter as `LEGACY_TOKEN_DEPRECATED` before checking modern session-recovery tokens, while the working public booking detail flow uses `access_token`/`accessToken` or an `sr_access` cookie set by `/bookings/recover`. As a result, unauthenticated receipt links such as the wizard success return path `/guest/bookings/:id/receipt?token=<reference>` pass the page-level redirect guard, fail server prefetch, then the client fetches without usable recovery credentials and shows `Receipt unavailable`. This is not an auth bypass because the backing API still denies data, but it breaks the intended receipt access path.

## Recommendation

Align this page with the public booking detail recovery flow: accept `access_token`/`accessToken`, redirect through `/bookings/recover` with `next=/guest/bookings/<id>/receipt` so `sr_access` is set, treat legacy `token` as deprecated, and allow prefetch only for an authenticated user or recovery cookie.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-24)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
