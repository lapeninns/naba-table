# [HIGH] Managers can mint owner invitations via direct API request

**File:** [`src/app/app/(app)/settings/restaurant/team/page.tsx`](<https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/app/(app)/settings/restaurant/team/page.tsx#L10-L11>) (lines 10, 11)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `acl-check`

## Owners

**Suggested assignee:** `aman.shrestha@mail.bcu.ac.uk` _(via last-committer)_

## Finding

The server-side invitation create schema accepts RESTAURANT_ROLE_OPTIONS, which includes owner, while requireAdminMembership allows both owners and managers. Although the UI role list omits owner, a manager can POST role="owner" directly to the invitation endpoint; the accept route later upserts invite.role into restaurant_memberships, promoting the invited account to owner.

## Recommendation

Enforce an inviteable-role allowlist on the server that excludes owner, or require an existing owner for owner invitations/promotions. Do not rely on the client-side role dropdown.

## Revalidation

**Verdict:** fixed

Although the UI still only offers manager, host, and server roles, the current protection is enforced in the API rather than only in the client. POST /api/ops/team/invitations calls assertInvitableRole before creating the invite. That helper checks the actor's actual restaurant_memberships role and applies canInviteRestaurantRole. The policy allows a manager to invite manager, host, or server, but not owner. A direct role owner request from a manager now returns 403 with INVITE_ROLE_FORBIDDEN instead of minting an owner invite. The client role list is no longer the only control.

## Recent committers (`git log`)

- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2026-01-17)
