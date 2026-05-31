# [HIGH] Managers can create owner invitations by bypassing the UI

**File:** [`src/app/api/ops/team/invitations/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/ops/team/invitations/route.ts#L23-L149) (lines 23, 26, 141, 146, 149)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The backend create schema accepts z.enum(RESTAURANT_ROLE_OPTIONS), which includes owner, while the POST authorization only requires requireAdminMembership, where managers are treated as admins. The UI role list omits owner, but a direct API caller can submit role: "owner". The invite acceptance flow upserts invite.role into restaurant_memberships, so a manager can invite an alternate account as owner and elevate privileges.

## Recommendation

Enforce inviteable roles server-side with a role hierarchy. Exclude owner from normal invitations, or require the current actor to be an owner before granting owner. Keep the backend allowlist aligned with the UI but do not rely on UI filtering.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-19)
