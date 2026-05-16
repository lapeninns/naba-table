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

## Revalidation

**Verdict:** fixed

The current implementation no longer lets an inviter obtain a bearer invite URL from this component or use an invite token to set another user's password. TeamInviteForm now displays only that the invitation email was sent and when it expires; it does not render or copy an inviteUrl. createRestaurantInvite generates a raw token, sends it only to sendTeamInviteEmail, and returns only { invite }, while the ops POST response serializes no token, inviteUrl, or token_hash. The public accept route now has a payload schema containing only optional name and does not read password at all. It requires an authenticated Supabase session before accepting an invite, and acceptInviteForAuthenticatedUser compares the authenticated user's normalized email with the invite email before granting membership. I found no current service.auth.admin.updateUserById or auth.admin.createUser call in the accept route or server/team/invitations.ts; membership is granted through the accept_restaurant_invite RPC after those checks. This was a real issue historically but was patched in 020a7389, with tests asserting no token exposure and no password mutation.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
