# [HIGH] Managers can tamper invite role to create owner memberships

**File:** [`src/components/features/team/TeamInviteForm.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/team/TeamInviteForm.tsx#L63-L66) (lines 63, 66)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The UI only renders Manager, Host, and Server options, but the submitted role is trusted as a RestaurantRole and the imported form/backend schemas accept RESTAURANT_ROLE_OPTIONS, which includes owner. The POST handler only requires requireAdminMembership, where manager is an admin role, and src/app/api/ops/team/invitations/route.ts accepts role: z.enum(RESTAURANT_ROLE_OPTIONS). The accept route later upserts restaurant_memberships with role: invite.role. A manager can bypass the UI with a crafted POST containing role='owner', accept the returned invite, and obtain owner-only capabilities such as restaurant deletion.

## Recommendation

Enforce inviteable roles server-side. Use a dedicated allowlist that excludes owner for manager callers, or require an existing owner to invite/assign owner. Reuse that same allowlist in the UI schema, but do not rely on the UI as the control.

## Revalidation

**Verdict:** fixed

I verified the full client-to-server-to-acceptance path for role tampering. The UI still only presents Manager, Host, and Server, and a crafted client value of owner can still reach the POST schema because createSchema uses RESTAURANT_ROLE_OPTIONS. The important current mitigation is server-side: after requireAdminMembership, the route calls assertInvitableRole with the authenticated actor user id, restaurant id, and requested role. assertInvitableRole checks the actor's actual membership and consults INVITABLE_ROLES_BY_ACTOR_ROLE, where managers cannot invite owner. If a manager tries role:"owner", the route returns 403 before inserting an invitation. Even if an old forbidden invite existed, acceptInviteForAuthenticatedUser calls assertInviteRoleStillAllowed before the accept_restaurant_invite RPC, preventing the owner membership upsert. Existing tests cover manager-owner rejection and owner-owner allowance, and git blame attributes this enforcement to 020a7389.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
