# [HIGH] Invite acceptance can reset passwords for existing users

**File:** [`src/components/features/team/TeamInviteForm.tsx`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/components/features/team/TeamInviteForm.tsx#L63-L173) (lines 63, 68, 168, 173)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `other-account-takeover`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The component exposes the returned invite URL to the inviter after creating an invite. The related accept handler looks up an existing Supabase auth user by the invited email and calls auth.admin.updateUserById with the password supplied to the public invite-accept request, without requiring that user to be signed in or verifying mailbox ownership. A malicious restaurant admin can invite a victim's existing email, copy the invite token, POST a chosen password to /api/team/invitations/{token}/accept, and then sign in as the victim, inheriting all of that user's restaurant memberships.

## Recommendation

Never reset an existing user's password from an invite token. For existing users, require authentication as that email or a verified email/OTP flow before adding membership. Consider not returning bearer invite tokens to the inviter when the invite targets an existing account.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-04)
