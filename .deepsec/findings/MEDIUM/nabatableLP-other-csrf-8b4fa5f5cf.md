# [MEDIUM] Draft creation POST lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/drafts/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/route.ts#L17-L30) (lines 17, 23, 30)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler authenticates and authorizes the admin, but does not validate the CSRF header before creating a Google Business Profile workflow draft. The downstream workflow refreshes Google business data, archives existing active drafts, and inserts a new draft. Since this endpoint has no request body requirement, a same-site attacker can trigger the mutation with a simple cookie-authenticated POST.

## Recommendation

Require validateCsrfToken(req) for this mutating session-cookie endpoint before calling createGoogleBusinessProfileWorkflowDraft.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-02)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
