# [HIGH_BUG] Invitation revoke endpoint hard-deletes rows and returns the wrong response shape

**File:** [`src/app/api/ops/team/invitations/[id]/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/team/invitations/[id]/route.ts#L54-L92) (lines 54, 71, 82, 85, 92)
**Project:** nabatableLP
**Severity:** HIGH_BUG • **Confidence:** high • **Slug:** `other-invitation-revoke-data-loss`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The route reads the invitation to check the restaurant, verifies admin membership, then deletes by id only and returns { success: true }. The shipped browser service calls this operation revokeInvite and expects a response containing an invite object, while server/team/invitations.ts already has revokeRestaurantInvite, which atomically updates status to revoked with restaurant_id and pending-status predicates. The current implementation loses invitation audit/history, can delete accepted/revoked/expired invitations, and has a stale read-then-delete window because the final delete is not constrained by restaurant_id or status.

## Recommendation

Replace the raw delete with revokeRestaurantInvite({ inviteId, restaurantId: invite.restaurant_id, authClient: supabase }), return the serialized invite, and ensure the update predicate includes id, restaurant_id, and status='pending'.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
