# [HIGH] Managers can grant owner role through direct invite payloads

**File:** [`server/team/invitations.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/team/invitations.ts#L71-L88) (lines 71, 74, 86, 88)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

createRestaurantInvite only checks that the requested role is any valid restaurant role, then inserts that role into restaurant_invites. The production create route accepts RESTAURANT_ROLE_OPTIONS and only requires requireAdminMembership, where managers are admins. Although the UI role list omits owner, a manager can POST `role: "owner"`, accept the invite for an email they control, and the accept route upserts `invite.role` into restaurant_memberships, elevating the manager-controlled account to owner.

## Recommendation

Enforce role-grant rules on the backend. Pass the inviter's membership role into the invitation creation path and reject owner invites unless the inviter is already an owner; more generally, prevent users from granting roles equal to or higher than their own privilege.

## Revalidation

**Verdict:** fixed

The create schema still accepts all RESTAURANT_ROLE_OPTIONS, including owner, but the backend now enforces role-grant policy after authentication. The ops invitation POST route calls requireAdminMembership and then assertInvitableRole with the current user, restaurantId, and requested role before creating the invite. assertInvitableRole fetches the actor membership and uses canInviteRestaurantRole from lib/owner/auth/roles.ts; that map permits owners to invite owners but limits managers to manager, host, and server. The accept path also calls assertInviteRoleStillAllowed before membership upsert, so an invite created under invalid or stale privileges is blocked at redemption time. The membership side effect is performed by the accept_restaurant_invite RPC only after that revalidation. I confirmed tests cover 'rejects manager attempts to invite an owner role' and 'revalidates invite role before membership upsert'. Commit 020a7389 added assertInvitableRole/assertInviteRoleStillAllowed and the current enforcement path.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)
