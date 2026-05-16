# [MEDIUM] Profile avatar upload does not validate CSRF tokens

**File:** [`src/app/api/profile/image/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/profile/image/route.ts#L51-L105) (lines 51, 53, 70, 96, 105)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The POST handler authenticates with cookie-bound Supabase auth and uploads multipart form data to public storage, but it never validates the CSRF token. A same-site attacker/browser context that can issue credentialed multipart requests could force storage writes under the victim user's avatar namespace.

## Recommendation

Require validateCsrfToken(req) before reading formData or uploading the file.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
