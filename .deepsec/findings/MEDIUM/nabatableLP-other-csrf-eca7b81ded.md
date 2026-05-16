# [MEDIUM] Zone mutation endpoints do not validate CSRF tokens

**File:** [`src/app/api/ops/zones/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/zones/[id]/route.ts#L23-L147) (lines 23, 35, 85, 108, 120, 147)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

Both PATCH and DELETE use cookie-bound Supabase auth and then mutate zone records, but neither validates the CSRF token. The app creates/sends CSRF tokens elsewhere, but this handler ignores them, allowing same-site credentialed request forgery to update or delete zones.

## Recommendation

Call validateCsrfToken(req) at the start of PATCH and DELETE before parsing route params or performing database mutations.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-11-27)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
