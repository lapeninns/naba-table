# [MEDIUM] Table inventory mutations lack server-side CSRF enforcement

**File:** [`src/services/ops/tables.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/services/ops/tables.ts#L250-L301) (lines 250, 251, 274, 275, 300, 301)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The service performs cookie-authenticated POST, PATCH, and DELETE requests for table inventory. The traced route handlers authenticate and authorize membership but never validate the double-submit CSRF token; the proxy only creates the CSRF cookie. A forged cookie-sending request can create or mutate table inventory without the server requiring the CSRF header that legitimate `fetchJson` clients send.

## Recommendation

Validate `validateCsrfToken(req)` in the table POST, PATCH, and DELETE handlers before reading request bodies or performing mutations.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-29)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-12)
