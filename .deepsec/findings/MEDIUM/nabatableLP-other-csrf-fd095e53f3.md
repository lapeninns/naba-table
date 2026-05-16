# [MEDIUM] OAuth initiation POST lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/google-business/connect/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business/connect/route.ts#L16-L23) (lines 16, 23)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The handler authenticates the user with requireGoogleBusinessAdminAccess, but it never validates the double-submit CSRF token before calling createGoogleBusinessProfileAuthorizationUrl. That call creates an OAuth state record and marks the external profile as pending_auth. Because the endpoint is cookie-authenticated and requires no request body, a same-site attacker or compromised subdomain can submit a simple POST with the victim's Supabase cookies and force Google Business Profile connection state changes for a restaurant the victim administers. The repo has CSRF helpers and the browser fetch wrapper sends x-csrf-token, but this handler does not enforce it.

## Recommendation

Reject mutating session-cookie requests unless validateCsrfToken(req) succeeds, returning 419/403 before creating OAuth state. Keep the client using the existing x-csrf-token header.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-28)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
