# [HIGH] Managers can create owner invitations by bypassing the client role list

**File:** [`src/app/api/ops/team/invitations/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/team/invitations/route.ts#L26-L149) (lines 26, 141, 149)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The server schema accepts every RESTAURANT_ROLE_OPTIONS value, including owner, while the shipped TeamInviteForm only offers manager, host, and server. Because requireAdminMembership allows managers and the accepted invite role is later written directly into restaurant_memberships, a manager can craft a POST body with role: "owner" and mint an owner invite.

## Recommendation

Define a server-side inviteable role allowlist that excludes owner, or require an existing owner to invite/promote owners. Enforce the same hierarchy in createRestaurantInvite and the accept path.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
