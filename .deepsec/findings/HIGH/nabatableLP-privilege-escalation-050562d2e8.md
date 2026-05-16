# [HIGH] Invitation creation exposes bearer invite tokens to the inviter

**File:** [`server/team/invitations.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/team/invitations.ts#L109-L114) (lines 109, 114)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `privilege-escalation`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

createRestaurantInvite sends the invite email but also returns the raw invite token and inviteUrl to its caller. The production ops invitation route relays those fields in its JSON response, and the public accept route later uses a valid token to create or admin-update the invited email's Supabase Auth account password. A restaurant admin can therefore invite an arbitrary existing user's email, read the returned token from the create response, call the accept endpoint with an attacker-chosen password, and take over that user's account without controlling the recipient mailbox.

## Recommendation

Do not return raw invite tokens or invite URLs from authenticated invite-creation APIs. Only deliver the token to the invited mailbox, and change invite acceptance for existing users to require an authenticated session for the invited email or a separate email-verified password-reset/OTP flow. Avoid admin-updating an existing user's password based only on an invite token.

## Revalidation

**Verdict:** fixed

CreateInviteResult now contains only { invite: RestaurantInvite }; it no longer includes token or inviteUrl. createRestaurantInvite still generates the raw token and passes it to sendTeamInviteEmail, but the token remains inside the email delivery flow and is not returned to the caller. The production create route at src/app/api/ops/team/invitations/route.ts serializes the invite with serializeInvite, which omits token_hash as well as any raw token or URL. I traced the accept route at src/app/api/team/invitations/[token]/accept/route.ts; it now requires a Supabase session and returns 401 unless the requester is signed in. acceptInviteForAuthenticatedUser checks that the authenticated user's email matches the invite email before calling the membership RPC. The accept payload schema no longer accepts password, and the security test asserts that auth.admin.createUser and auth.admin.updateUserById are not called even if a password is supplied. Commit 020a7389 removed token and inviteUrl from CreateInviteResult and added the authenticated matching-email accept flow.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)
