# [HIGH_BUG] Revoke permanently deletes invite records and breaks the client response contract

**File:** [`src/components/features/team/TeamInvitesTable.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/team/TeamInvitesTable.tsx#L69-L70) (lines 69, 70)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-data-loss`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The table calls the revoke mutation with a restaurantId and inviteId, but the backing DELETE route hard-deletes the restaurant_invites row and returns {success:true}. The browser service expects {invite: ...} and parses it as a RestaurantInvite, so successful revokes surface as client errors and the query is not invalidated. Because the route deletes instead of marking status revoked, revoked invitation history/audit data is lost and the revoked status filter cannot show those records.

## Recommendation

Change DELETE to use the existing revokeRestaurantInvite-style status update, set revoked_at, and return {invite: serializedInvite} matching the client schema. Keep hard delete as a separate owner-only maintenance path if needed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)
