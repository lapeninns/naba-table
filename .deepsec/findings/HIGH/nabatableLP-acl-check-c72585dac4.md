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

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)

**Verdict:** fixed

Recovered after the worktree reset from the 2026-05-16 DeepSec remediation session. The matching source, migration, and regression-test changes have been replayed onto `codex/deepsec-remediation-20260516`; this marker preserves the resolved backlog state for the finding.
