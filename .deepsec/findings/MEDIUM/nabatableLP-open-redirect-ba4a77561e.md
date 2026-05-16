# [MEDIUM] Request origin is built from unvalidated forwarded host headers

**File:** [`src/app/api/ops/google-business-profile/_origin.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/google-business-profile/_origin.ts#L17-L27) (lines 17, 23, 24, 27)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `open-redirect`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

getRequestOrigin() trusts the first x-forwarded-proto and x-forwarded-host values, falling back to Host, and returns them as an absolute origin without checking them against the configured app/root domains. This helper is used by the public Google Business Profile callback to build redirect URLs before a valid OAuth state is required on error/incomplete responses, and by connect routes to persist the OAuth returnPath. If the deployment forwards attacker-controlled Host or X-Forwarded-Host values, an unauthenticated request such as the callback with ?error=access_denied can produce a Location header pointing at an attacker-controlled origin.

## Recommendation

Build callback origins from a trusted configured origin, or validate forwarded/Host values against an allowlist derived from NEXT_PUBLIC_ROOT_DOMAIN/app hosts. Treat stored OAuth return paths as relative same-origin paths unless they pass the same validation.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-18)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
