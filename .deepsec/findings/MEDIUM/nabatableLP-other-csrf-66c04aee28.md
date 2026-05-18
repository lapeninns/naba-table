# [MEDIUM] State-changing restaurant ops requests lack server-side CSRF enforcement

**File:** [`src/services/ops/restaurants.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/restaurants.ts#L1250-L1532) (lines 1250, 1266, 1296, 1337, 1353, 1371, 1383, 1413, 1436, 1450, 1464, 1479, 1495, 1509, 1520, 1532)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

This service issues many cookie-authenticated state-changing requests for restaurant settings, hours, service periods, turn bands, email templates, test sends, and Google Business Profile workflows. `fetchJson` adds an `x-csrf-token` header for legitimate clients, but tracing the corresponding `src/app/api/ops/restaurants/**` route handlers shows no `validateCsrfToken` checks, and `src/proxy.ts` only sets the CSRF cookie. Cookie-sending forged requests can therefore trigger mutations that do not require password confirmation.

## Recommendation

Call `validateCsrfToken(req)` at the start of every mutating ops route before parsing the body or performing side effects, and return 403 or 419 on failure.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
