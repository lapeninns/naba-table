# [MEDIUM] Zone creation does not validate the CSRF token

**File:** [`src/app/api/ops/zones/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/zones/route.ts#L77-L134) (lines 77, 79, 83, 89, 113, 127, 134)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

POST uses the cookie-bound Supabase session and mutates restaurant zone configuration, but it never calls the repository's validateCsrfToken helper before parsing and applying the request. If a browser context sends the victim staff member's cookies and the attacker knows the public restaurant id, the membership check authenticates the victim but does not prove request intent.

## Recommendation

Reject unsafe methods unless validateCsrfToken(req) succeeds before reading the JSON body. Also require application/json and consider Origin/Referer checks as defense in depth.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-27)
