# [MEDIUM] Cookie-authenticated preflight mutation lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish/preflight/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/publish/preflight/route.ts#L62-L94) (lines 62, 71, 81, 94)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST handler authenticates the session and verifies admin membership, but it never calls validateCsrfToken before parsing attacker-controlled JSON and invoking preflightGoogleBusinessProfileWorkflowDraft. That imported workflow can mark drafts stale and insert/update publish-job state. Because this is a cookie-authenticated unsafe method, a same-site attacker context can submit a forged request with the victim admin's cookies and mutate Google Business Profile workflow state.

## Recommendation

Reject unsafe methods unless validateCsrfToken(req) succeeds before parsing the request body or performing workflow work. Return 419 or 403 on failure.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-02)
