# [BUG] Draft creation archives the active review before the replacement insert succeeds

**File:** [`server/google-business-profile/workflowDraftLifecycle.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/server/google-business-profile/workflowDraftLifecycle.ts#L109-L141) (lines 109, 114, 119, 141)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-data-integrity`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

createGoogleBusinessProfileWorkflowDraftState first archives existing active drafts, then inserts the new draft as a separate database operation. If the insert fails after the archive succeeds, for example due to a constraint race or transient database error, the previous active review is left archived and read-only with no replacement draft. That can discard an in-progress or approved review workflow and block publishing until the state is manually recovered or regenerated.

## Recommendation

Move the archive-and-insert sequence into a single database transaction/RPC, ideally under a per-restaurant/provider lock. Roll back the archive if the insert fails, or use an atomic function that archives the old active row and inserts the replacement row together.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-24)
