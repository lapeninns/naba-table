# [MEDIUM] Admin auto-export POST lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/dual-sync/auto-export/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/dual-sync/auto-export/route.ts#L37-L66) (lines 37, 48, 66)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-missing-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The route authenticates the admin with a session cookie and then runs a service-role dual-sync auto-export that can publish changes to Google, but it never validates the repo's CSRF token. The global proxy sets the CSRF cookie only; it does not reject missing or mismatched tokens on this route.

## Recommendation

Call validateCsrfToken(req) before resolving the request body or running auto-export, return 419 on failure, and ensure the client sends the shared x-csrf-token header.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-30)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
