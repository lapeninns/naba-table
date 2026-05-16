# [MEDIUM] No CSRF validation on booking no-show mutation

**File:** [`src/app/api/ops/bookings/[id]/no-show/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/no-show/route.ts#L31-L43) (lines 31, 37, 43)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler authenticates with the user's session cookie via loadLifecycleRouteContext, but never validates the x-csrf-token/sr-csrf-token double-submit token before mutating booking state. The body is optional, so a request with no body can still mark a known booking as no-show. The client fetchJson helper emits CSRF headers, but this route does not enforce them.

## Recommendation

Call validateCsrfToken(req) before parsing or mutating, return 403/419 on failure, and keep using fetchJson or otherwise send the CSRF header from all legitimate clients.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
