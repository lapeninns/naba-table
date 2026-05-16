# [CRITICAL] Invitation acceptance can take over existing or new email accounts

**File:** [`src/app/api/team/invitations/[token]/accept/route.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/src/app/api/team/invitations/[token]/accept/route.ts#L117-L160) (lines 117, 121, 123, 124, 134, 135, 136, 152, 160)
**Project:** nabatableLP
**Severity:** CRITICAL • **Confidence:** high • **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

The public token acceptance handler treats possession of an invitation token as authority to create or modify a Supabase auth user for invite.email. For new users it calls service.auth.admin.createUser with the caller-supplied password and email_confirm: true; for existing users it calls service.auth.admin.updateUserById with the caller-supplied password and email_confirm: true. It then grants the restaurant membership. The related invite creation route returns the raw token/inviteUrl to the inviting admin, so a malicious tenant admin can invite a victim email, use the returned token, set a password, and gain a confirmed account or reset an existing account without proving mailbox ownership.

## Recommendation

Do not create confirmed users or reset existing passwords from an invite token alone. For existing users, require an authenticated session whose verified email matches the invite. For new users, deliver account setup only through an email-verified Supabase OTP/recovery flow. Stop returning bearer invite tokens to inviters, or make returned links non-credential administrative references.

## Revalidation

**Verdict:** fixed

The current code treats the invitation token as insufficient by itself: the handler requires an existing authenticated Supabase session before it looks up and accepts the invite. For existing users, acceptInviteForAuthenticatedUser normalizes and compares user.email to invite.email and throws INVITE_EMAIL_MISMATCH if they differ. For new users, this endpoint no longer creates a confirmed Supabase auth user at all, so a malicious inviter cannot manufacture a confirmed account for a victim email through this route. Membership creation is performed by the accept_restaurant_invite RPC after the email and role checks, not by auth admin user creation or password mutation. The RPC updates the pending invite and upserts the membership in one database function, so the acceptance side effects are now atomic at the database transaction level. This was patched in 020a7389, which added the atomic migration and rewrote the accept flow.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-12-27)
