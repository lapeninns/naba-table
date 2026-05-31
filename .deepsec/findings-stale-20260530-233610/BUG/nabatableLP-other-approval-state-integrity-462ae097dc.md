# [BUG] Approved draft selections can be changed without resetting approval state

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/[draftId]/route.ts#L82) (lines 82)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-approval-state-integrity`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The PATCH route passes arbitrary selectedApprovals, decisions, and status into updateGoogleBusinessProfileWorkflowDraft. The imported lifecycle code treats approved drafts as editable and updates selected_approvals without clearing approved_at/approved_by_user_id or moving the draft back to review_ready when selections change. An authenticated restaurant admin can therefore modify choices after approval while the draft remains publishable and the audit metadata still reflects the older approval.

## Recommendation

Reject selection/decision changes for approved drafts, or automatically reset status to review_ready and clear approval metadata whenever selectedApprovals or decisions change after approval. Only stamp approval metadata when approving the exact choices being stored.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
