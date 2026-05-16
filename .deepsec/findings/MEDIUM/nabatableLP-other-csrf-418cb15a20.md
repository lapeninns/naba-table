# [MEDIUM] Location selection POST lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/google-business/locations/select/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business/locations/select/route.ts#L25-L41) (lines 25, 31, 40, 41)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler authenticates the ambient Supabase session and then accepts JSON to link a Google Business Profile location and immediately run a sync, but it never calls validateCsrfToken or otherwise verifies the x-csrf-token header. The browser client may attach a CSRF header via fetchJson, but the server does not enforce it, leaving this session-cookie mutation exposed to same-site request forgery and other ambient-cookie request contexts.

## Recommendation

Require validateCsrfToken(req) before parsing or mutating state, return 419 on failure, and keep the existing admin membership check as the authorization layer.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-28)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
