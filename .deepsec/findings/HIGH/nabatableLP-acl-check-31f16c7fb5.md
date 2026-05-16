# [HIGH] Managers can create owner invitations by bypassing the client role list

**File:** [`src/app/api/ops/team/invitations/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/team/invitations/route.ts#L26-L149) (lines 26, 141, 149)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The server schema accepts every RESTAURANT_ROLE_OPTIONS value, including owner, while the shipped TeamInviteForm only offers manager, host, and server. Because requireAdminMembership allows managers and the accepted invite role is later written directly into restaurant_memberships, a manager can craft a POST body with role: "owner" and mint an owner invite.

## Recommendation

Define a server-side inviteable role allowlist that excludes owner, or require an existing owner to invite/promote owners. Enforce the same hierarchy in createRestaurantInvite and the accept path.

## Revalidation

**Verdict:** fixed

The server now performs an independent invite-role authorization check rather than relying on the TeamInviteForm role dropdown. After validating the POST body, the handler calls assertInvitableRole before createRestaurantInvite. The roles policy in lib/owner/auth/roles.ts defines INVITABLE_ROLES_BY_ACTOR_ROLE, where manager does not include owner. A crafted direct API request with role owner from a manager therefore fails with INVITE_ROLE_FORBIDDEN and returns 403. Owner invitations are still possible when the actor is already an owner, which matches the recommended role-hierarchy option. The manager-to-owner privilege escalation is fixed.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
