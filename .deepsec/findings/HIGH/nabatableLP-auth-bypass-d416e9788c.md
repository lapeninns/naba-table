# [HIGH] Invite creator receives raw acceptance token, enabling mailbox bypass and account takeover

**File:** [`server/team/invitations.ts`](https://github.com/lapeninns/nabatable/blob/codex/Menu/blob/codex/server/team/invitations.ts#L36-L114) (lines 36, 38, 39, 80, 81, 109, 114)
**Project:** nabatableLP
**Severity:** HIGH • **Confidence:** high • **Slug:** `auth-bypass`

## Owners

**Suggested assignee:** `159779640+amanshresthaa@users.noreply.github.com` _(via last-committer)_

## Finding

createRestaurantInvite generates a bearer invite token, stores only its hash, sends it by email, but also returns the raw token and inviteUrl to its caller. The ops invitation route relays those fields in its JSON response, and the public accept route treats token possession as sufficient proof to create a confirmed account or update an existing account's password for the invited email. A restaurant admin can invite a victim's existing email, read the token from the create response, and accept the invite with an attacker-chosen password without controlling the victim mailbox.

## Recommendation

Do not return raw invite tokens or invite URLs from the admin create API. Deliver the token only to the invited email, and make acceptance prove control of the invited identity, such as by requiring an authenticated Supabase user whose email matches the invite or a separate email verification/OTP before setting or changing passwords.

## Revalidation

**Verdict:** fixed

The current code closes both parts of the described attack. The invite creator no longer receives the raw token or inviteUrl from createRestaurantInvite, and the ops API response only includes serialized invite metadata without token_hash. Possession of the token alone is also no longer sufficient to set or change the invited account password. The public accept route first calls sessionClient.auth.getUser and rejects unauthenticated requests with 'Sign in as the invited email before accepting this invitation'. It then calls acceptInviteForAuthenticatedUser, which normalizes and compares user.email to invite.email and throws INVITE_EMAIL_MISMATCH on mismatch. The implementation uses the accept_restaurant_invite RPC to add membership and does not call Supabase admin password mutation APIs. The tests/server/team-invitations-security.test.ts file includes regression coverage for not exposing token/inviteUrl and for rejecting a mismatched session email. Commit 020a7389 is the patch that removed the raw return values and introduced the authenticated acceptance function.

## Recent committers (`git log`)

- amanshresthaa <159779640+amanshresthaa@users.noreply.github.com> (2026-05-05)
- amanshresthaa <aman.shrestha@mail.bcu.ac.uk> (2025-10-26)
