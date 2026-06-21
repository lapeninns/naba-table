# [BUG] Revoke mutation succeeds server-side but fails client parsing

**File:** [`src/components/features/team/TeamInvitesTable.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/team/TeamInvitesTable.tsx#L69-L157) (lines 69, 70, 157)
**Project:** nabatableLP
**Severity:** BUG • **Confidence:** high • **Slug:** `other-contract-bug`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The table calls revokeInvite.mutate for the selected invite. The browser service expects DELETE /api/team/invitations/{id} to return { invite } and parses it as a RestaurantInvite, but the ops DELETE handler returns { success: true }. That means the invitation can be deleted server-side while the mutation throws on the client, so onSuccess invalidation does not run and the UI can show stale or failed state. The handler also hard-deletes the invite instead of marking it revoked, losing the revoked invitation history that the table status filter implies should exist.

## Recommendation

Make the DELETE contract match the client: either return the revoked invite and update status/revoked_at instead of deleting, or change the client mutation schema and invalidation path to handle { success: true } intentionally.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)
