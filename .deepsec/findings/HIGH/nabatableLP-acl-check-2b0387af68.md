# [HIGH] Managers can grant owner role through direct invite payloads

**File:** [`server/team/invitations.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/team/invitations.ts#L71-L88) (lines 71, 74, 86, 88)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

createRestaurantInvite only checks that the requested role is any valid restaurant role, then inserts that role into restaurant_invites. The production create route accepts RESTAURANT_ROLE_OPTIONS and only requires requireAdminMembership, where managers are admins. Although the UI role list omits owner, a manager can POST `role: "owner"`, accept the invite for an email they control, and the accept route upserts `invite.role` into restaurant_memberships, elevating the manager-controlled account to owner.

## Recommendation

Enforce role-grant rules on the backend. Pass the inviter's membership role into the invitation creation path and reject owner invites unless the inviter is already an owner; more generally, prevent users from granting roles equal to or higher than their own privilege.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)
