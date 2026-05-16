# [MEDIUM] Missing CSRF validation on booking check-in mutation

**File:** [`src/app/api/ops/bookings/[id]/check-in/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/check-in/route.ts#L32-L78) (lines 32, 38, 44, 78)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This session-cookie POST route mutates booking state through persistLifecycleTransition, but neither the handler nor the shared lifecycle helper validates the x-csrf-token header. The browser client adds a CSRF header via fetchJson, and the proxy only sets the CSRF cookie; the server never enforces it here. A forged same-site request from a compromised sibling subdomain or other same-site context could check in a booking using the victim staff session.

## Recommendation

Call validateCsrfToken(req) at the start of the handler before parsing the body or loading lifecycle context, and return 403 on failure. Add a negative test for missing/invalid CSRF tokens.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-25)
