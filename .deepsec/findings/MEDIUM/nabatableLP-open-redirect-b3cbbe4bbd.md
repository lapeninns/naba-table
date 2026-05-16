# [MEDIUM] Callback redirects trust forwarded host and stored absolute return paths

**File:** [`src/app/api/ops/google-business-profile/callback/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/google-business-profile/callback/route.ts#L11-L45) (lines 11, 12, 43, 45)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

Redirect targets are built from getRequestOrigin(req), which trusts x-forwarded-host/host without an allowlist, and successful callbacks redirect to result.returnPath from the OAuth state without sanitizeRedirect-style validation. If the deployment path lets clients influence forwarded host headers, error callbacks or stored return paths can become redirects to an attacker-controlled origin.

## Recommendation

Use a configured trusted app origin for this OAuth flow, store relative return paths, and validate any stored or computed redirect target against the known root/app host allowlist before calling NextResponse.redirect.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-23)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
