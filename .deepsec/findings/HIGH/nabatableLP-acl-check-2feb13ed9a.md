# [HIGH] Managers can create owner invitations by bypassing the UI

**File:** [`src/app/api/ops/team/invitations/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/team/invitations/route.ts#L23-L149) (lines 23, 26, 141, 146, 149)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The backend create schema accepts z.enum(RESTAURANT_ROLE_OPTIONS), which includes owner, while the POST authorization only requires requireAdminMembership, where managers are treated as admins. The UI role list omits owner, but a direct API caller can submit role: "owner". The invite acceptance flow upserts invite.role into restaurant_memberships, so a manager can invite an alternate account as owner and elevate privileges.

## Recommendation

Enforce inviteable roles server-side with a role hierarchy. Exclude owner from normal invitations, or require the current actor to be an owner before granting owner. Keep the backend allowlist aligned with the UI but do not rely on UI filtering.

## Revalidation

**Verdict:** fixed

The create schema still accepts RESTAURANT_ROLE_OPTIONS, including owner, but the backend now enforces a server-side role hierarchy after parsing. POST calls requireAdminMembership and then assertInvitableRole with the actor user id, restaurant id, and requested role. assertInvitableRole loads the actor's membership and calls canInviteRestaurantRole from lib/owner/auth/roles.ts. That role matrix allows owners to invite owners, but managers may invite only manager, host, or server, explicitly excluding owner. If a manager submits role owner directly, the route maps INVITE_ROLE_FORBIDDEN to a 403 response. This fixes the UI-bypass escalation described in the finding.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
