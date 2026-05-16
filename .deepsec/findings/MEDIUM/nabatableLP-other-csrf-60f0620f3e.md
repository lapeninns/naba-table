# [MEDIUM] Undo no-show endpoint does not enforce CSRF

**File:** [`src/app/api/ops/bookings/[id]/undo-no-show/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/undo-no-show/route.ts#L29-L93) (lines 29, 51, 93)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST /api/ops/bookings/[id]/undo-no-show mutates booking lifecycle state and reads state history after session auth, but it never validates the CSRF token. Because fetchJson clients already send x-csrf-token and the server helper exists, this route is missing the intended server-side check. A forged same-site request could make an authenticated staff user undo a no-show for a known booking.

## Recommendation

Require validateCsrfToken(req) before body parsing or lifecycle work, and return a failure response when the header/cookie pair is absent or mismatched.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
