# [MEDIUM] Deprecated status mutation lacks CSRF validation

**File:** [`src/app/api/ops/bookings/[id]/status/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/bookings/[id]/status/route.ts#L46-L260) (lines 46, 137, 239, 260)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

PATCH /api/ops/bookings/[id]/status authenticates the Supabase user, but it does not validate the x-csrf-token/sr-csrf-token pair before applying no-show or completed lifecycle transitions, clearing table assignments, and scheduling checkout side effects. The JSON body can be sent as a simple text/plain request and parsed by req.json(), so missing server-side CSRF validation leaves this session-cookie endpoint forgeable in same-site attack scenarios.

## Recommendation

Call validateCsrfToken(req) before reading the body or loading the booking, and reject failures with a session-expiry/CSRF status such as 419.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-05)
