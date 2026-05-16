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

## Revalidation

**Verdict:** fixed

`src/app/api/ops/team/invitations/[id]/route.ts` now calls `revokeRestaurantInvite` and returns `{ invite }` with the serialized revoked invitation. `server/team/invitations.ts` soft-revokes pending invitations with `status = 'revoked'` and `revoked_at` instead of hard-deleting rows. `src/services/ops/team.ts` parses the returned `invite` through `restaurantInviteSchema`, so the client mutation contract matches the server response and invalidation can run normally.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)
