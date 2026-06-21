# [BUG] Draft replacement can archive the current draft without creating a replacement

**File:** [`src/app/api/ops/restaurants/[id]/google-business-profile/drafts/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/restaurant-settings-hardening/blob/codex/src/app/api/ops/restaurants/[id]/google-business-profile/drafts/route.ts#L43-L47) (lines 43, 44, 45, 46, 47)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-nontransactional-state-change`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The POST route calls createGoogleBusinessProfileWorkflowDraft. The imported lifecycle archives existing active drafts before inserting the new draft, but those operations are not wrapped in a transaction/RPC. If the insert fails after the archive update, the restaurant can be left with no active review draft and any in-progress review state hidden as archived.

## Recommendation

Move archive-and-insert into a single database transaction/RPC, or insert the replacement first and only archive the previous active drafts after the new draft is durable. Consider a partial unique constraint for the active draft invariant.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-19)
