# [MEDIUM] Manual Google Business sync POST lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/google-business/sync/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business/sync/route.ts#L16-L23) (lines 16, 17, 23)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** medium • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler relies on the ambient Supabase session, performs admin authorization, and then runs syncGoogleBusinessProfileBusinessInformation(), which refreshes Google credentials, calls external Google APIs, and writes sync state. It does not validate the repo's double-submit CSRF token before performing this mutation. The endpoint also takes no body, which makes forged POSTs easier than JSON-only mutations.

## Recommendation

Call validateCsrfToken(req) before running the sync, return 419 on failure, and add a per-user/per-restaurant rate limit for manual sync attempts.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-28)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
