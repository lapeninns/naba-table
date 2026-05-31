# [HIGH] Invitation link lets inviter reset an existing user's password

**File:** [`src/components/features/team/TeamInviteForm.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/team/TeamInviteForm.tsx#L63-L173) (lines 63, 68, 172, 173)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

TeamInviteForm creates an invite and stores/displays the returned inviteUrl to the inviter. The backend also returns the raw token/inviteUrl, and the public accept route treats possession of that token as sufficient to set a password for any existing Supabase auth user whose email matches the invite. In src/app/api/team/invitations/[token]/accept/route.ts, findAuthUserByEmail locates an existing user by invite email, then service.auth.admin.updateUserById(existing.id, { password: parsedPayload.data.password, email_confirm: true, ... }) resets that account. An owner/manager can invite victim@example.com, copy the link shown here, submit the accept form with a new password, and take over the victim's account, including access to any other restaurants tied to that user.

## Recommendation

Do not allow an invite token alone to update an existing auth user's password or metadata. For existing users, require an authenticated session whose verified email matches the invite email, or send a Supabase recovery/magic-link flow to the invited email. Also avoid returning raw invite tokens to inviters unless the accept flow cannot mutate existing credentials.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)
