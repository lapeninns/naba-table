# [MEDIUM] State-changing OAuth initiation is exposed as GET

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/connect/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/connect/route.ts#L18-L36) (lines 18, 30, 36)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The GET handler performs admin-authenticated OAuth setup by calling createGoogleBusinessProfileAuthorizationUrl and then redirecting to Google. The service creates an OAuth state row and updates the restaurant external profile to pending_auth. Since this is a cookie-authenticated GET, a top-level cross-site navigation can carry SameSite=Lax cookies and force an admin browser to start the OAuth flow and mutate connection state. The handler also has no CSRF token check.

## Recommendation

Make OAuth initiation a POST-only action and require validateCsrfToken(req) before creating OAuth state. Keep GET routes side-effect free.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-04-23)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
