# [BUG] Lead insert failures are silently reported as success

**File:** [`src/app/api/lead/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/lead/route.ts#L35-L38) (lines 35, 36, 38)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-silent-write-failure`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

Supabase insert errors are returned in the resolved result object, but the handler does not inspect the error field. If RLS, constraints, or a database failure reject the insert without throwing, the route still returns a 200 response, causing lead data loss with no client-visible failure.

## Recommendation

Capture the insert result, check error, log a sanitized message, and return a non-2xx response when the insert fails.

## Revalidation

**Verdict:** fixed

`src/app/api/lead/route.ts` now captures the Supabase insert result and returns `500` when the resolved `error` field is present. The response is generic while the server log keeps the insert failure details. `tests/server/lead-route.test.ts` asserts that resolved insert errors no longer return success.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)
