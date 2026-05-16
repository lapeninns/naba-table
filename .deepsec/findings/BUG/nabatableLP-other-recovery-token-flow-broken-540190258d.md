# [BUG] Receipt page ignores the active session-recovery access flow

**File:** [`src/app/guest/bookings/[bookingId]/receipt/page.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/guest/bookings/[bookingId]/receipt/page.tsx#L18-L107) (lines 18, 40, 41, 42, 91, 101, 102, 103, 107)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-recovery-token-flow-broken`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The receipt page only accepts a `token` query parameter, treats any non-empty value as sufficient to skip the sign-in redirect, and forwards it to `/api/bookings/{id}`. The traced booking API rejects `token` as a deprecated legacy token and authorizes modern guest recovery through `access_token`/`accessToken` or the `sr_access` cookie. Unlike the main booking detail page, this page also does not check for the `sr_access` cookie before redirecting unauthenticated users. As a result, valid unauthenticated guest recovery sessions cannot open receipt pages, while arbitrary `?token=` values only produce a failed client fetch. This is not a data disclosure because the API still enforces ownership, but it breaks the receipt access flow.

## Recommendation

Mirror the main booking detail recovery flow: accept `access_token`/`accessToken`, redirect those requests through `/bookings/recover` with `next=/guest/bookings/{id}/receipt`, explicitly reject legacy `token`, and allow a valid `sr_access` cookie to satisfy the unauthenticated page gate before prefetching.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-08)
