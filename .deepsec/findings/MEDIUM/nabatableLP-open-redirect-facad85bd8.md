# [MEDIUM] OAuth callback redirects trust forwarded host headers

**File:** [`src/app/api/ops/restaurants/[id]/google-business/callback/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business/callback/route.ts#L13-L66) (lines 13, 31, 37, 54, 66)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The callback builds redirect origins from getRequestOrigin(req) at lines 13 and 54, and all error paths can reach NextResponse.redirect without a valid OAuth state. The imported getRequestOrigin helper trusts x-forwarded-host before host with no allowlist. If the deployment forwards client-supplied X-Forwarded-Host, a request such as the callback URL with an OAuth error can produce a Location header on an attacker-controlled origin. The same origin helper is also used for the success redirect base.

## Recommendation

Build callback redirects from a configured canonical app origin or validate forwarded/host values against the expected root and app hosts before using them. Also validate stored returnPath values with the existing redirect allowlist/sanitize helper before redirecting.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-28)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
