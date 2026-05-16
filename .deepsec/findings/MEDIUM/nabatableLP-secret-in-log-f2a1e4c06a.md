# [MEDIUM] Auth callback logs one-time login credentials in the full URL

**File:** [`src/app/api/auth/callback/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/auth/callback/route.ts#L118-L261) (lines 118, 119, 125, 130, 205, 261)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secret-in-log`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The callback reads code and token_hash from the query string, then logs req.url as fullUrl before exchanging or verifying those values. That full URL contains the Supabase OAuth/PKCE code or magic-link token hash. Any centralized log sink or support/debug log access can receive login material during its validity window and potentially race or replay unused callback credentials.

## Recommendation

Never log the raw callback URL or query string. Log only booleans/request IDs, or explicitly redact code, token_hash, access tokens, and other auth parameters before writing diagnostics.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
