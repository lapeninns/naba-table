# [MEDIUM] Cookie-authenticated draft update lacks CSRF validation

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/route.ts#L49-L78) (lines 49, 58, 65, 78)
**Project:** nabatableLP
**Severity:** MEDIUM • **Confidence:** high • **Slug:** `other-csrf`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The PATCH handler verifies the user is an admin for the requested restaurant, but it performs no CSRF token validation before accepting JSON that can change selectedApprovals, decisions, and status, including approving a draft. A forged same-site request from a victim admin session could alter draft review state without the admin intentionally using the workflow.

## Recommendation

Require validateCsrfToken(req) for this unsafe method before req.json() and before calling updateGoogleBusinessProfileWorkflowDraft.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-02)
