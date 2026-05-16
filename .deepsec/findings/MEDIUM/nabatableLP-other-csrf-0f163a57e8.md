# [MEDIUM] Hold-creating quote POST lacks CSRF validation

**File:** [`src/app/api/staff/auto/quote/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/staff/auto/quote/route.ts#L20-L74) (lines 20, 21, 32, 74)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

POST uses cookie-bound Supabase auth, then accepts JSON and calls quoteTables with a tenant service client. quoteTables can create table holds under the authenticated user, but the route does not validate the CSRF header/cookie pair. A forged credentialed POST in a context where the session cookies are sent could create capacity holds as the victim staff user.

## Recommendation

Call validateCsrfToken(req) before parsing the body or creating holds, and return 403 when the token is absent or invalid.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-07)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
