# [MEDIUM] No CSRF validation on undo no-show mutation

**File:** [`src/app/api/ops/bookings/[id]/undo-no-show/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/undo-no-show/route.ts#L29-L41) (lines 29, 35, 41)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler uses the session cookie to authenticate and then mutates booking state through service-role Supabase, but it never validates the CSRF token. The request body is optional, so a bodyless POST is enough to undo a known no-show booking if the victim has membership for that restaurant.

## Recommendation

Require validateCsrfToken(req) before processing the request and reject missing or mismatched tokens before any state-changing work.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
