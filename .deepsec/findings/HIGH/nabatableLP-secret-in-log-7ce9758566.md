# [HIGH] Auth callback logs magic-link token hashes and OAuth codes

**File:** [`src/app/api/auth/callback/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/auth/callback/route.ts#L117-L130) (lines 117, 118, 119, 125, 130)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `secret-in-log`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The callback extracts code and token_hash from the request URL, then logs fullUrl: req.url before exchanging or verifying the token. For magic-link flows, the token_hash is embedded directly in the callback URL, and OAuth/PKCE callbacks include the authorization code. Sending those values to application logs exposes login credentials to log readers and log-processing systems; in some failure or race cases they can be replayed to establish a session.

## Recommendation

Never log full callback URLs. Log only non-sensitive metadata such as path, host, and booleans, or explicitly redact code, token_hash, access_token, refresh_token, and similar parameters before logging. Add a regression test for auth callback log redaction.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-02-15)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
