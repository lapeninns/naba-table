# [BUG] Lead insert failures are silently reported as success

**File:** [`src/app/api/lead/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/lead/route.ts#L35-L38) (lines 35, 36, 38)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-silent-write-failure`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Supabase insert errors are returned in the resolved result object, but the handler does not inspect the error field. If RLS, constraints, or a database failure reject the insert without throwing, the route still returns a 200 response, causing lead data loss with no client-visible failure.

## Recommendation

Capture the insert result, check error, log a sanitized message, and return a non-2xx response when the insert fails.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)
