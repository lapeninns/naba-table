# [MEDIUM] Vercel token can leak through failed child-process command logging

**File:** [`scripts/email/setup-notifications-domain.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/scripts/email/setup-notifications-domain.ts#L230-L356) (lines 230, 231, 236, 334, 340, 355, 356)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `secret-in-log`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

runVercelDnsAdd builds a Vercel CLI argv containing `--token` and the raw VERCEL_TOKEN, then execFileSync runs it. If the child command exits non-zero, Node's execFileSync error message includes the full command line, and the top-level catch logs `error.message`, exposing the token in terminal or CI logs. The token is also present in the child process argv while the command runs.

## Recommendation

Do not pass VERCEL_TOKEN as a CLI argument. Prefer the Vercel CLI environment variable support, e.g. pass it via the child `env` option and omit `--token`; also redact command/error messages before logging child-process failures.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-03-25)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-28)
